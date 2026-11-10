import {isNullish} from './nullish'

// Per-PR previews are published as `pr-<N>-<worker>.<subdomain>.workers.dev`
// versions of a worker -- for sign-in, versions of the dev worker, which has its
// own GitHub App. GitHub Apps cannot register a wildcard callback URL, so a
// preview cannot be the redirect target of the OAuth dance; it asks the dev
// worker to run it and hand the authorization code back.
const WORKERS_DEV_HOST_PATTERN = /^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/u
const PREVIEW_PREFIX_PATTERN = /^pr-\d+-$/u

// The only path a code is ever forwarded to. Fixed rather than caller-supplied:
// the requested callback is validated against it, so a valid host cannot be used
// to aim a code at some other route.
export const CALLBACK_PATH = '/api/auth/github/callback'

export interface PreviewAuthConfig {
  // The dev worker's origin. A preview is a version of that same worker, so it
  // shares the dev app's client secret -- which is why the code can be forwarded
  // rather than a token, and why this must not point at production.
  proxyURL?: string
}

export function readPreviewAuthConfig(): PreviewAuthConfig {
  return {proxyURL: process.env.PREVIEW_AUTH_PROXY_URL}
}

export interface IsPreviewHostParams {
  hostname: string
  // The dev worker's origin. Only previews of that worker count.
  proxyURL: string | undefined
}

// True for a host that is a per-PR preview of the dev worker, and nothing else.
// This is the allowlist deciding who an authorization code may be forwarded to,
// so it matches the full hostname against the dev worker's own name and
// workers.dev subdomain. The subdomain is pinned because each account has its
// own.
export function isPreviewHost({hostname, proxyURL}: IsPreviewHostParams): boolean {
  const devHost = parseHostname(proxyURL)
  if (isNullish(devHost) || !WORKERS_DEV_HOST_PATTERN.test(devHost)) {
    return false
  }
  const host = hostname.toLowerCase()
  if (!host.endsWith(devHost)) {
    return false
  }
  return PREVIEW_PREFIX_PATTERN.test(host.slice(0, host.length - devHost.length))
}

// Validates a callback URL a preview asked the dev worker to send its code to.
// Returns it only when it is the callback path on an https preview of the dev
// worker, rebuilt from the parsed parts so no query, port or credentials ride
// along.
export function parseProxyCallbackURL(
  value: string | null | undefined,
  config: PreviewAuthConfig,
): string | undefined {
  const url = parseURL(value)
  if (
    isNullish(url) ||
    url.protocol !== 'https:' ||
    !isPreviewHost({hostname: url.hostname, proxyURL: config.proxyURL}) ||
    url.pathname !== CALLBACK_PATH
  ) {
    return undefined
  }
  return `https://${url.hostname}${CALLBACK_PATH}`
}

// True when this request is served by a per-PR preview of the dev worker. A
// preview with nothing configured has nowhere to send anyone.
export function shouldProxySignIn(requestURL: URL, config = readPreviewAuthConfig()): boolean {
  return isPreviewHost({hostname: requestURL.hostname, proxyURL: config.proxyURL})
}

// True only on the dev worker itself, the one deployment that runs the OAuth
// dance for previews. Production has no proxy origin, so it never brokers.
export function isSignInBroker(requestURL: URL, config: PreviewAuthConfig): boolean {
  const proxyURL = parseURL(config.proxyURL)
  return !isNullish(proxyURL) && proxyURL.origin === requestURL.origin
}

function parseURL(value: string | null | undefined): URL | undefined {
  if (isNullish(value) || value === '') {
    return undefined
  }
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

function parseHostname(value: string | undefined): string | undefined {
  return parseURL(value)?.hostname.toLowerCase()
}

export interface ProxyState {
  // The preview's own CSRF value, bound to its browser by a cookie it set before
  // delegating. It rides through GitHub and comes back for the preview to check.
  csrf: string
  // Where the code goes once GitHub returns it.
  proxyAuthTo: string
}

// GitHub round-trips `state` verbatim, so the dev worker carries what it needs
// there rather than in a cookie of its own. That keeps the dev worker stateless
// across the round trip -- nothing to lose, expire, or collide when two previews
// are being signed into from one browser.
export function encodeProxyState(state: ProxyState): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(state)))
}

// Undefined for an ordinary sign-in, whose state is a bare random value. Never
// trusts the decoded target: the caller re-validates it against the allowlist.
export function decodeProxyState(value: string | null): ProxyState | undefined {
  if (isNullish(value) || value === '') {
    return undefined
  }

  let text: string
  try {
    text = new TextDecoder().decode(decodeBase64Url(value))
  } catch {
    return undefined
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return undefined
  }

  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  const {csrf, proxyAuthTo} = data as Record<string, unknown>
  if (typeof csrf !== 'string' || csrf === '' || typeof proxyAuthTo !== 'string') {
    return undefined
  }
  return {csrf, proxyAuthTo}
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0
  }
  return bytes
}
