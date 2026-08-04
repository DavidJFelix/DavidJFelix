import {
  createRedirectResponse,
  encodeCookiePayload,
  type GitHubAuthOptions,
  type GitHubAuthSession,
  isSecureRequest,
  readCookiePayload,
  resolveGitHubAuth,
  sanitizeReturnPath,
  serializeCookie,
  serializeSessionCookie,
  withSetCookieHeaders,
} from './github-auth'
import {isNullish} from './nullish'
import {
  createVerifier,
  deriveChallenge,
  importHandoffKey,
  isPreviewHost,
  openHandoff,
  parsePreviewOrigin,
  readSession,
  sealHandoff,
} from './preview-auth'

// Paths are fixed rather than configurable: the broker builds a redirect back
// into the preview, and the preview builds one into the broker, so both sides
// have to agree on them without coordination.
export const PREVIEW_CALLBACK_PATH = '/api/auth/github/preview-callback'
export const BROKER_AUTHORIZE_PATH = '/api/auth/github/preview-authorize'
export const BROKER_REDEEM_PATH = '/api/auth/github/preview-redeem'

// By call signature only: lib.dom types `typeof fetch` with a required static
// `preconnect`, which a stub cannot (and need not) satisfy. Mirrors the diffs
// file loader's own fetch type.
type BrokerFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

// Only has to outlive one redirect to the broker and back.
const VERIFIER_COOKIE_NAME = 'diffs-preview-verifier'
const VERIFIER_COOKIE_MAX_AGE_SECONDS = 5 * 60

export interface PreviewAuthConfig {
  // Where a preview sends visitors to sign in: a stable origin whose callback
  // URL is registered on a GitHub App. Absent on production, which runs its own
  // OAuth and never brokers.
  brokerURL?: string
  // The broker's AES-GCM sealing key, base64. Present only on the broker.
  handoffKey?: string
}

export function readPreviewAuthConfig(): PreviewAuthConfig {
  return {
    brokerURL: process.env.PREVIEW_AUTH_BROKER_URL,
    handoffKey: process.env.PREVIEW_AUTH_HANDOFF_KEY,
  }
}

// True when this request is being served by a per-PR preview that has a broker
// to borrow. Both halves matter: production must never hand sign-in off, and a
// preview with no broker configured has nowhere to send anyone.
export function shouldBrokerSignIn(request: Request, config = readPreviewAuthConfig()): boolean {
  const url = new URL(request.url)
  return isPreviewHost(url.hostname) && !isNullish(config.brokerURL) && config.brokerURL !== ''
}

// Preview side, step 1. Keeps a fresh verifier in an HttpOnly cookie on this
// origin and sends only its hash to the broker, so the value that can redeem the
// handoff never travels in a URL.
export async function handlePreviewSignInStart(
  request: Request,
  config = readPreviewAuthConfig(),
): Promise<Response> {
  const url = new URL(request.url)
  const brokerURL = config.brokerURL
  if (isNullish(brokerURL) || !isPreviewHost(url.hostname)) {
    return createErrorResponse('Preview sign-in is not available on this origin.', 404)
  }

  const returnPath = sanitizeReturnPath(url.searchParams.get('returnTo'))
  const verifier = createVerifier()
  const challenge = await deriveChallenge(verifier)

  let authorizeURL: URL
  try {
    authorizeURL = new URL(BROKER_AUTHORIZE_PATH, brokerURL)
  } catch {
    return createErrorResponse('Preview sign-in broker is misconfigured.', 500)
  }
  authorizeURL.searchParams.set('origin', `https://${url.hostname}`)
  authorizeURL.searchParams.set('challenge', challenge)

  return createRedirectResponse(authorizeURL.href, [
    serializeCookie({
      name: VERIFIER_COOKIE_NAME,
      value: encodeCookiePayload({verifier, returnPath}),
      maxAgeSeconds: VERIFIER_COOKIE_MAX_AGE_SECONDS,
      secure: isSecureRequest(url),
    }),
  ])
}

// Preview side, step 3. Redeems the sealed handoff against the broker by
// presenting the verifier, then writes the session cookie for this origin. The
// redemption is server-to-server: the browser never sees the token.
export async function handlePreviewSignInCallback(
  request: Request,
  config = readPreviewAuthConfig(),
  fetcher: BrokerFetch = fetch,
): Promise<Response> {
  const url = new URL(request.url)
  const brokerURL = config.brokerURL
  if (isNullish(brokerURL) || !isPreviewHost(url.hostname)) {
    return createErrorResponse('Preview sign-in is not available on this origin.', 404)
  }

  const cookie = readCookiePayload(request, VERIFIER_COOKIE_NAME)
  const verifier = typeof cookie?.verifier === 'string' ? cookie.verifier : undefined
  const returnPath = sanitizeReturnPath(
    typeof cookie?.returnPath === 'string' ? cookie.returnPath : null,
  )
  const handoff = url.searchParams.get('handoff')
  const clearVerifier = serializeCookie({
    name: VERIFIER_COOKIE_NAME,
    value: '',
    maxAgeSeconds: 0,
    secure: isSecureRequest(url),
  })

  if (isNullish(verifier) || isNullish(handoff)) {
    return createErrorResponse('Preview sign-in did not complete. Start again.', 400, [
      clearVerifier,
    ])
  }

  const session = await redeemAtBroker({brokerURL, fetcher, handoff, verifier})
  if (isNullish(session)) {
    return createErrorResponse('Preview sign-in could not be verified. Start again.', 400, [
      clearVerifier,
    ])
  }

  return createRedirectResponse(returnPath, [
    clearVerifier,
    serializeSessionCookie(session, isSecureRequest(url)),
  ])
}

// Broker side, step 2. Requires a session on the broker's own stable origin --
// sending the visitor through its normal OAuth when there is none -- then seals
// that session against the preview's challenge.
export async function handlePreviewBrokerAuthorize(
  request: Request,
  config = readPreviewAuthConfig(),
  options: GitHubAuthOptions = {},
): Promise<Response> {
  const url = new URL(request.url)
  const key = await resolveHandoffKey(config)
  if (isNullish(key)) {
    return createErrorResponse('Preview sign-in broker is not configured here.', 404)
  }

  // The allowlist: a token is only ever handed to an https per-PR preview host.
  const origin = parsePreviewOrigin(url.searchParams.get('origin'))
  const challenge = url.searchParams.get('challenge')
  if (isNullish(origin) || isNullish(challenge) || challenge === '') {
    return createErrorResponse('Preview sign-in request is not valid.', 400)
  }

  const auth = await resolveGitHubAuth(request, options)
  if (isNullish(auth.session)) {
    // Come back here once signed in, so the visitor lands on the preview rather
    // than on the broker's own pages.
    const loginURL = new URL('/api/auth/github/login', url)
    loginURL.searchParams.set('returnTo', `${url.pathname}${url.search}`)
    return withSetCookieHeaders(Response.redirect(loginURL.href, 302), auth.setCookieHeaders)
  }

  const handoff = await sealHandoff({challenge, key, session: auth.session})
  const target = new URL(PREVIEW_CALLBACK_PATH, origin)
  target.searchParams.set('handoff', handoff)
  return createRedirectResponse(target.href, auth.setCookieHeaders)
}

// Broker side, step 4. Opens a handoff for whoever can produce the verifier it
// was sealed against. This is the one place a token leaves the broker, so it
// answers nothing at all when the proof does not check out.
export async function handlePreviewBrokerRedeem(
  request: Request,
  config = readPreviewAuthConfig(),
): Promise<Response> {
  const key = await resolveHandoffKey(config)
  if (isNullish(key)) {
    return createErrorResponse('Preview sign-in broker is not configured here.', 404)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('A JSON body with handoff and verifier is required.', 400)
  }

  const {handoff, verifier} = readRedeemBody(body)
  if (isNullish(handoff) || isNullish(verifier)) {
    return createErrorResponse('A JSON body with handoff and verifier is required.', 400)
  }

  const session = await openHandoff({handoff, key, verifier})
  if (isNullish(session)) {
    // Deliberately one message for every failure -- expired, forged, tampered,
    // or wrong verifier -- so a caller learns nothing by probing.
    return createErrorResponse('Handoff could not be redeemed.', 400)
  }
  return Response.json({session}, {headers: {'Cache-Control': 'no-store'}})
}

interface RedeemAtBrokerParams {
  brokerURL: string
  fetcher: BrokerFetch
  handoff: string
  verifier: string
}

async function redeemAtBroker({
  brokerURL,
  fetcher,
  handoff,
  verifier,
}: RedeemAtBrokerParams): Promise<GitHubAuthSession | undefined> {
  let redeemURL: URL
  try {
    redeemURL = new URL(BROKER_REDEEM_PATH, brokerURL)
  } catch {
    return undefined
  }

  let response: Response
  try {
    response = await fetcher(redeemURL.href, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({handoff, verifier}),
    })
  } catch {
    return undefined
  }
  if (!response.ok) {
    return undefined
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    return undefined
  }
  return readSessionResponse(data)
}

function readRedeemBody(body: unknown): {handoff?: string; verifier?: string} {
  if (typeof body !== 'object' || body === null) {
    return {}
  }
  const {handoff, verifier} = body as Record<string, unknown>
  return {
    handoff: typeof handoff === 'string' && handoff !== '' ? handoff : undefined,
    verifier: typeof verifier === 'string' && verifier !== '' ? verifier : undefined,
  }
}

function readSessionResponse(data: unknown): GitHubAuthSession | undefined {
  if (typeof data !== 'object' || data === null || !('session' in data)) {
    return undefined
  }
  const {session} = data as {session: unknown}
  if (typeof session !== 'object' || session === null) {
    return undefined
  }
  const record = session as Record<string, unknown>
  return typeof record.accessToken === 'string' && record.accessToken !== ''
    ? readSession(record)
    : undefined
}

function resolveHandoffKey(config: PreviewAuthConfig): Promise<CryptoKey | undefined> | undefined {
  const secret = config.handoffKey
  if (isNullish(secret) || secret === '') {
    return undefined
  }
  return importHandoffKey(secret)
}

function createErrorResponse(
  message: string,
  status: number,
  setCookieHeaders: readonly string[] = [],
): Response {
  return withSetCookieHeaders(
    Response.json({error: message}, {status, headers: {'Cache-Control': 'no-store'}}),
    setCookieHeaders,
  )
}
