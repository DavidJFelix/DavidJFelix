import {isNullish} from './nullish'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_API_VERSION = '2022-11-28'
const USER_AGENT = 'revision-city-diffs'

const AUTH_COOKIE_NAME = 'diffs-github-auth'
const STATE_COOKIE_NAME = 'diffs-github-oauth-state'
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60
// Cookie lifetime when GitHub reports no token expiry (the app has
// user-to-server token expiration disabled). GitHub still invalidates such
// tokens after a year without use; the cookie only needs to outlive active use.
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60
// Treat tokens as expired slightly early so one that would lapse mid-request
// never reaches GitHub.
const EXPIRY_MARGIN_MS = 60 * 1000
const DEFAULT_RETURN_PATH = '/diffs'
const CALLBACK_PATH = '/diffs/api/auth/callback'
// Every consumer of the session lives under /diffs, so the cookie never rides
// along on requests to the rest of the site.
const COOKIE_PATH = '/diffs'

type AuthFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface GitHubAppCredentials {
  clientId: string
  clientSecret: string
}

export interface GitHubAuthOptions {
  credentials?: GitHubAppCredentials
  fetch?: AuthFetch
}

export interface GitHubAuthSession {
  accessToken: string
  accessTokenExpiresAt?: number
  refreshToken?: string
  refreshTokenExpiresAt?: number
  login: string
  avatarUrl?: string
}

export interface ResolvedGitHubAuth {
  session: GitHubAuthSession | undefined
  setCookieHeaders: readonly string[]
}

// Starts the GitHub App web flow: binds a random state value to this browser
// via a short-lived cookie, then forwards to GitHub's authorize page.
export function handleGitHubLoginRequest(
  request: Request,
  options: GitHubAuthOptions = {},
): Response {
  const credentials = options.credentials ?? readGitHubAppCredentials()
  if (isNullish(credentials)) {
    return createAuthUnavailableResponse()
  }

  const requestURL = new URL(request.url)
  const returnPath = sanitizeReturnPath(requestURL.searchParams.get('returnTo'))
  const state = crypto.randomUUID()
  const authorizeURL = new URL(GITHUB_AUTHORIZE_URL)
  authorizeURL.searchParams.set('client_id', credentials.clientId)
  authorizeURL.searchParams.set('redirect_uri', new URL(CALLBACK_PATH, requestURL).href)
  authorizeURL.searchParams.set('state', state)

  return createRedirectResponse(authorizeURL.href, [
    serializeCookie({
      name: STATE_COOKIE_NAME,
      value: encodeCookiePayload({state, returnPath}),
      maxAgeSeconds: STATE_COOKIE_MAX_AGE_SECONDS,
      secure: isSecureRequest(requestURL),
    }),
  ])
}

// Completes the web flow: verifies the state cookie, exchanges the code for a
// user access token, and stores the session in an HttpOnly cookie. The token
// never reaches the browser as readable data.
export async function handleGitHubOAuthCallbackRequest(
  request: Request,
  options: GitHubAuthOptions = {},
): Promise<Response> {
  const credentials = options.credentials ?? readGitHubAppCredentials()
  if (isNullish(credentials)) {
    return createAuthUnavailableResponse()
  }

  const requestURL = new URL(request.url)
  const secure = isSecureRequest(requestURL)
  const clearStateCookie = serializeExpiredCookie(STATE_COOKIE_NAME, secure)
  const stateCookie = readStateCookie(request)
  const returnPath = stateCookie?.returnPath ?? DEFAULT_RETURN_PATH

  // The user declined authorization (or GitHub reported another error): land
  // back where they started, signed out, instead of surfacing an error page.
  if (!isNullish(requestURL.searchParams.get('error'))) {
    return createRedirectResponse(returnPath, [clearStateCookie])
  }

  const code = requestURL.searchParams.get('code')
  const state = requestURL.searchParams.get('state')
  if (
    isNullish(code) ||
    isNullish(state) ||
    isNullish(stateCookie) ||
    state !== stateCookie.state
  ) {
    return createAuthTextResponse('Invalid OAuth state. Start the sign-in again.', 400, [
      clearStateCookie,
    ])
  }

  const fetcher = options.fetch ?? fetch
  const grant = await requestGitHubTokenGrant(
    {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: new URL(CALLBACK_PATH, requestURL).href,
    },
    fetcher,
  )
  if (isNullish(grant)) {
    return createAuthTextResponse('GitHub sign-in failed. Try again.', 502, [clearStateCookie])
  }

  const user = await fetchGitHubUser(grant.accessToken, fetcher)
  if (isNullish(user)) {
    return createAuthTextResponse('GitHub sign-in failed. Try again.', 502, [clearStateCookie])
  }

  const session: GitHubAuthSession = {...grant, ...user}
  return createRedirectResponse(returnPath, [
    clearStateCookie,
    serializeSessionCookie(session, secure),
  ])
}

export function handleGitHubLogoutRequest(request: Request): Response {
  const requestURL = new URL(request.url)
  const returnPath = sanitizeReturnPath(requestURL.searchParams.get('returnTo'))
  return createRedirectResponse(returnPath, [
    serializeExpiredCookie(AUTH_COOKIE_NAME, isSecureRequest(requestURL)),
  ])
}

// Reports whether the browser holds a usable session so the UI can render the
// sign-in state without ever seeing the token.
export async function handleGitHubSessionRequest(
  request: Request,
  options: GitHubAuthOptions = {},
): Promise<Response> {
  const auth = await resolveGitHubAuth(request, options)
  const body = isNullish(auth.session)
    ? {authenticated: false}
    : {
        authenticated: true,
        login: auth.session.login,
        avatarUrl: auth.session.avatarUrl,
      }
  const response = Response.json(body, {
    headers: {'Cache-Control': 'no-store', Vary: 'Cookie'},
  })
  return withSetCookieHeaders(response, auth.setCookieHeaders)
}

// Reads the session cookie and returns a session with a currently-valid access
// token, refreshing through GitHub when the app issues expiring tokens. Callers
// must forward setCookieHeaders so refreshed (or dead) sessions reach the
// browser.
export async function resolveGitHubAuth(
  request: Request,
  options: GitHubAuthOptions = {},
): Promise<ResolvedGitHubAuth> {
  const session = readSessionCookie(request)
  if (isNullish(session)) {
    return {session: undefined, setCookieHeaders: []}
  }

  const now = Date.now()
  if (
    isNullish(session.accessTokenExpiresAt) ||
    session.accessTokenExpiresAt - EXPIRY_MARGIN_MS > now
  ) {
    return {session, setCookieHeaders: []}
  }

  const secure = isSecureRequest(new URL(request.url))
  const expiredCookies = [serializeExpiredCookie(AUTH_COOKIE_NAME, secure)]
  const credentials = options.credentials ?? readGitHubAppCredentials()
  const refreshTokenExpired =
    !isNullish(session.refreshTokenExpiresAt) &&
    session.refreshTokenExpiresAt - EXPIRY_MARGIN_MS <= now
  if (isNullish(session.refreshToken) || isNullish(credentials) || refreshTokenExpired) {
    return {session: undefined, setCookieHeaders: expiredCookies}
  }

  const grant = await requestGitHubTokenGrant(
    {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    },
    options.fetch ?? fetch,
  )
  if (isNullish(grant)) {
    return {session: undefined, setCookieHeaders: expiredCookies}
  }

  const refreshed: GitHubAuthSession = {
    ...grant,
    login: session.login,
    avatarUrl: session.avatarUrl,
  }
  return {session: refreshed, setCookieHeaders: [serializeSessionCookie(refreshed, secure)]}
}

export function withSetCookieHeaders(
  response: Response,
  setCookieHeaders: readonly string[],
): Response {
  for (const header of setCookieHeaders) {
    response.headers.append('Set-Cookie', header)
  }
  return response
}

function readGitHubAppCredentials(): GitHubAppCredentials | undefined {
  const clientId = process.env.GITHUB_APP_CLIENT_ID
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET
  if (isNullish(clientId) || clientId === '' || isNullish(clientSecret) || clientSecret === '') {
    return undefined
  }
  return {clientId, clientSecret}
}

interface GitHubTokenGrant {
  accessToken: string
  accessTokenExpiresAt?: number
  refreshToken?: string
  refreshTokenExpiresAt?: number
}

// Calls GitHub's token endpoint for both the initial code exchange and refresh
// grants. GitHub reports failures as 200s with an `error` field, so both paths
// are checked.
async function requestGitHubTokenGrant(
  body: Record<string, string>,
  fetcher: AuthFetch,
): Promise<GitHubTokenGrant | undefined> {
  try {
    const response = await fetcher(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {Accept: 'application/json', 'User-Agent': USER_AGENT},
      body: new URLSearchParams(body),
    })
    if (!response.ok) {
      return undefined
    }

    const data: unknown = await response.json()
    if (!isRecord(data) || typeof data.access_token !== 'string' || data.access_token === '') {
      return undefined
    }

    const now = Date.now()
    return {
      accessToken: data.access_token,
      accessTokenExpiresAt: readExpiry(now, data.expires_in),
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      refreshTokenExpiresAt: readExpiry(now, data.refresh_token_expires_in),
    }
  } catch {
    return undefined
  }
}

async function fetchGitHubUser(
  token: string,
  fetcher: AuthFetch,
): Promise<{login: string; avatarUrl?: string} | undefined> {
  try {
    const response = await fetcher(GITHUB_USER_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    })
    if (!response.ok) {
      return undefined
    }

    const data: unknown = await response.json()
    if (!isRecord(data) || typeof data.login !== 'string' || data.login === '') {
      return undefined
    }
    return {
      login: data.login,
      avatarUrl: typeof data.avatar_url === 'string' ? data.avatar_url : undefined,
    }
  } catch {
    return undefined
  }
}

function readExpiry(now: number, expiresInSeconds: unknown): number | undefined {
  return typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds)
    ? now + expiresInSeconds * 1000
    : undefined
}

function readSessionCookie(request: Request): GitHubAuthSession | undefined {
  const payload = readCookiePayload(request, AUTH_COOKIE_NAME)
  if (
    isNullish(payload) ||
    typeof payload.accessToken !== 'string' ||
    payload.accessToken === '' ||
    typeof payload.login !== 'string' ||
    payload.login === ''
  ) {
    return undefined
  }
  return {
    accessToken: payload.accessToken,
    accessTokenExpiresAt: readOptionalNumber(payload.accessTokenExpiresAt),
    refreshToken: readOptionalString(payload.refreshToken),
    refreshTokenExpiresAt: readOptionalNumber(payload.refreshTokenExpiresAt),
    login: payload.login,
    avatarUrl: readOptionalString(payload.avatarUrl),
  }
}

function readStateCookie(request: Request): {state: string; returnPath: string} | undefined {
  const payload = readCookiePayload(request, STATE_COOKIE_NAME)
  if (isNullish(payload) || typeof payload.state !== 'string' || payload.state === '') {
    return undefined
  }
  return {
    state: payload.state,
    returnPath: sanitizeReturnPath(readOptionalString(payload.returnPath) ?? null),
  }
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readCookiePayload(request: Request, name: string): Record<string, unknown> | undefined {
  const value = parseCookies(request.headers.get('cookie')).get(name)
  if (isNullish(value)) {
    return undefined
  }

  try {
    const payload: unknown = JSON.parse(decodeURIComponent(value))
    return isRecord(payload) ? payload : undefined
  } catch {
    return undefined
  }
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  if (isNullish(header)) {
    return cookies
  }

  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    cookies.set(pair.slice(0, separatorIndex).trim(), pair.slice(separatorIndex + 1).trim())
  }
  return cookies
}

function serializeSessionCookie(session: GitHubAuthSession, secure: boolean): string {
  const now = Date.now()
  const expiry = session.refreshTokenExpiresAt ?? session.accessTokenExpiresAt
  const maxAgeSeconds = isNullish(expiry)
    ? DEFAULT_COOKIE_MAX_AGE_SECONDS
    : Math.max(0, Math.ceil((expiry - now) / 1000))
  return serializeCookie({
    name: AUTH_COOKIE_NAME,
    value: encodeCookiePayload({...session}),
    maxAgeSeconds,
    secure,
  })
}

function serializeExpiredCookie(name: string, secure: boolean): string {
  return serializeCookie({name, value: '', maxAgeSeconds: 0, secure})
}

interface SerializeCookieParams {
  name: string
  value: string
  maxAgeSeconds: number
  secure: boolean
}

// HttpOnly keeps the token out of reach of page scripts; SameSite=Lax still
// sends the cookie on the top-level redirect back from github.com. `Secure` is
// dropped only for plain-HTTP local dev.
function serializeCookie({name, value, maxAgeSeconds, secure}: SerializeCookieParams): string {
  const attributes = [
    `${name}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    `Path=${COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) {
    attributes.push('Secure')
  }
  return attributes.join('; ')
}

function encodeCookiePayload(payload: Record<string, unknown>): string {
  return encodeURIComponent(JSON.stringify(payload))
}

// Only same-site absolute paths are allowed as post-auth destinations, so the
// flow cannot be used as an open redirect.
function sanitizeReturnPath(value: string | null): string {
  if (
    isNullish(value) ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\n\r]/u.test(value)
  ) {
    return DEFAULT_RETURN_PATH
  }
  return value
}

function isSecureRequest(url: URL): boolean {
  return url.protocol === 'https:'
}

function createRedirectResponse(location: string, setCookieHeaders: readonly string[]): Response {
  const response = new Response(null, {
    status: 302,
    headers: {Location: location, 'Cache-Control': 'no-store'},
  })
  return withSetCookieHeaders(response, setCookieHeaders)
}

function createAuthTextResponse(
  message: string,
  status: number,
  setCookieHeaders: readonly string[] = [],
): Response {
  const response = new Response(message, {
    status,
    headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'},
  })
  return withSetCookieHeaders(response, setCookieHeaders)
}

function createAuthUnavailableResponse(): Response {
  return createAuthTextResponse(
    'GitHub sign-in is not configured. Set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.',
    503,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
