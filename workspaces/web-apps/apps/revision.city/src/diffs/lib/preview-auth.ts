import type {GitHubAuthSession} from './github-auth'
import {isNullish} from './nullish'

// Per-PR previews are published as `pr-<N>-<worker>.<subdomain>.workers.dev`
// versions of the same worker. GitHub Apps cannot register a wildcard callback
// URL, so a preview cannot run the OAuth dance itself; it borrows a broker on a
// stable host that can.
const PREVIEW_HOST_PATTERN = /^pr-\d+-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/u

// The window between the broker sealing a handoff and the preview redeeming it
// is one redirect plus one server-to-server call. Anything longer is a replay.
const HANDOFF_TTL_MS = 60 * 1000

const HANDOFF_VERSION = 'v1'

export interface PreviewHandoffPayload {
  readonly session: GitHubAuthSession
  // base64url SHA-256 of the verifier the preview kept to itself. Redeeming
  // requires producing the verifier, which never travels in a URL.
  readonly challenge: string
  readonly expiresAt: number
}

// True for a host that is a per-PR preview of a worker, and nothing else. This
// is the allowlist that decides who may be handed a token, so it matches the
// full hostname rather than a prefix or suffix.
export function isPreviewHost(hostname: string): boolean {
  return PREVIEW_HOST_PATTERN.test(hostname.toLowerCase())
}

// Parses a caller-supplied origin and returns it only when it names a preview
// host over https. Anything else -- another site, a look-alike host, plain http
// -- is refused, because the broker hands real credentials to whatever this
// returns.
export function parsePreviewOrigin(value: string | null): string | undefined {
  if (isNullish(value) || value === '') {
    return undefined
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }

  if (url.protocol !== 'https:' || !isPreviewHost(url.hostname)) {
    return undefined
  }
  // Rebuilt from the parsed parts so no path, query, credentials or port rides
  // along into the redirect target.
  return `https://${url.hostname}`
}

export function createVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

export async function deriveChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return encodeBase64Url(new Uint8Array(digest))
}

export interface SealHandoffParams {
  challenge: string
  key: CryptoKey
  now?: number
  session: GitHubAuthSession
}

// Seals a session so it can cross origins through a redirect. The result is
// opaque to the preview and to anything that logs the URL: only the broker holds
// the key, and only the holder of the verifier can get it back out.
export async function sealHandoff({
  challenge,
  key,
  now = Date.now(),
  session,
}: SealHandoffParams): Promise<string> {
  const payload: PreviewHandoffPayload = {
    session,
    challenge,
    expiresAt: now + HANDOFF_TTL_MS,
  }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv},
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  return [HANDOFF_VERSION, encodeBase64Url(iv), encodeBase64Url(new Uint8Array(sealed))].join('.')
}

export interface OpenHandoffParams {
  handoff: string
  key: CryptoKey
  now?: number
  verifier: string
}

// Returns the session only when the handoff decrypts, has not expired, and the
// presented verifier hashes to the challenge it was sealed with. Any failure
// returns undefined rather than throwing, so a caller cannot distinguish a
// forged handoff from a stale one.
export async function openHandoff({
  handoff,
  key,
  now = Date.now(),
  verifier,
}: OpenHandoffParams): Promise<GitHubAuthSession | undefined> {
  const parts = handoff.split('.')
  if (parts.length !== 3 || parts[0] !== HANDOFF_VERSION) {
    return undefined
  }

  const iv = decodeBase64Url(parts[1])
  const sealed = decodeBase64Url(parts[2])
  if (isNullish(iv) || isNullish(sealed)) {
    return undefined
  }

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, sealed)
  } catch {
    return undefined
  }

  const payload = parsePayload(new TextDecoder().decode(plaintext))
  if (payload === undefined || payload.expiresAt <= now) {
    return undefined
  }
  return (await deriveChallenge(verifier)) === payload.challenge ? payload.session : undefined
}

// The broker's sealing key, supplied as a base64 secret. Kept separate from the
// GitHub App secret so rotating one does not force rotating the other.
export async function importHandoffKey(secret: string): Promise<CryptoKey | undefined> {
  const raw = decodeBase64Url(secret.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''))
  if (isNullish(raw) || raw.length !== 32) {
    return undefined
  }
  return crypto.subtle.importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt'])
}

function parsePayload(text: string): PreviewHandoffPayload | undefined {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return undefined
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('session' in data) ||
    !('challenge' in data) ||
    !('expiresAt' in data)
  ) {
    return undefined
  }

  const {session, challenge, expiresAt} = data
  if (
    typeof challenge !== 'string' ||
    typeof expiresAt !== 'number' ||
    typeof session !== 'object' ||
    session === null ||
    !('accessToken' in session) ||
    typeof session.accessToken !== 'string'
  ) {
    return undefined
  }
  return {session: readSession(session), challenge, expiresAt}
}

// Exported so the preview side can normalize the session the broker returns
// with the same rules the broker used to seal it.
export function readSession(value: Record<string, unknown>): GitHubAuthSession {
  return {
    accessToken: String(value.accessToken),
    login: typeof value.login === 'string' ? value.login : '',
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    accessTokenExpiresAt:
      typeof value.accessTokenExpiresAt === 'number' ? value.accessTokenExpiresAt : undefined,
    refreshToken: typeof value.refreshToken === 'string' ? value.refreshToken : undefined,
    refreshTokenExpiresAt:
      typeof value.refreshTokenExpiresAt === 'number' ? value.refreshTokenExpiresAt : undefined,
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

// Backed by a concrete ArrayBuffer rather than the ArrayBufferLike that
// Uint8Array.from infers, which WebCrypto's BufferSource will not accept.
function decodeBase64Url(value: string | undefined): Uint8Array<ArrayBuffer> | undefined {
  if (isNullish(value) || value === '') {
    return undefined
  }

  let binary: string
  try {
    binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
  } catch {
    return undefined
  }

  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0
  }
  return bytes
}
