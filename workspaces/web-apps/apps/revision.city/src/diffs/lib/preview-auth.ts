import {isNullish} from './nullish'

// Per-PR previews are published as `pr-<N>-<worker>.<subdomain>.workers.dev`
// versions of the same worker. GitHub Apps cannot register a wildcard callback
// URL, so a preview cannot be the redirect target of the OAuth dance; it borrows
// a stable origin that can, and that origin hands the authorization code back.
const PREVIEW_HOST_PATTERN = /^pr-\d+-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/u

export interface PreviewAuthConfig {
  // A stable origin of this same worker whose callback URL is registered on the
  // GitHub App. "Same worker" is what keeps this simple: the preview shares the
  // client secret, so it completes the token exchange itself and no session ever
  // crosses an origin -- only the authorization code does, which is inert
  // without that secret.
  brokerURL?: string
}

export function readPreviewAuthConfig(): PreviewAuthConfig {
  return {brokerURL: process.env.PREVIEW_AUTH_BROKER_URL}
}

// True for a host that is a per-PR preview of a worker, and nothing else. This
// is the allowlist deciding who an authorization code may be forwarded to, so it
// matches the full hostname rather than a prefix or suffix.
export function isPreviewHost(hostname: string): boolean {
  return PREVIEW_HOST_PATTERN.test(hostname.toLowerCase())
}

// Parses a caller-supplied origin and returns it only when it names a preview
// host over https. Anything else -- another site, a look-alike host, plain http
// -- is refused, because the stable origin forwards a live authorization code to
// whatever this returns.
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

// True when this request is served by a per-PR preview that has a stable origin
// to borrow. Both halves matter: production must never delegate, and a preview
// with nothing configured has nowhere to send anyone.
export function shouldBorrowSignIn(requestURL: URL, config = readPreviewAuthConfig()): boolean {
  return (
    isPreviewHost(requestURL.hostname) && !isNullish(config.brokerURL) && config.brokerURL !== ''
  )
}
