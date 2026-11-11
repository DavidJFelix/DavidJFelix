// Reverse-proxy routing for PostHog (US cloud). The on-demand /diag endpoint
// (src/routes/diag) serves these on this domain so a content blocker that drops
// *.posthog.com can't drop our analytics. PostHog splits traffic across two
// upstreams: the SDK bundle and remote config load from the assets host; events,
// flags, and the rest are ingestion/API traffic.

export const INGEST_PREFIX = '/diag'

const US_INGESTION_HOST = 'us.i.posthog.com'
const US_ASSETS_HOST = 'us-assets.i.posthog.com'

// posthog-js fetches array.js and its remote config from the assets host under
// these prefixes; every other path is ingestion/API.
const ASSET_PREFIXES = ['/static/', '/array/']

export interface PostHogUpstream {
  host: string
  pathname: string
}

// Map an incoming /diag/* request path to the PostHog host and upstream path
// it should be proxied to.
export function postHogUpstream(pathname: string): PostHogUpstream {
  const rest = pathname.slice(INGEST_PREFIX.length) || '/'
  const host = ASSET_PREFIXES.some((prefix) => rest.startsWith(prefix))
    ? US_ASSETS_HOST
    : US_INGESTION_HOST
  return {host, pathname: rest}
}

// Stop a stalled upstream at this limit, so that it cannot hold the worker until the platform
// deadline. After the limit, the proxy aborts and returns a 504.
const UPSTREAM_TIMEOUT_MS = 10_000

// posthog-js sends only GET and POST. The proxy refuses all other methods before a forward.
const ALLOWED_METHODS = ['GET', 'POST']

export type FetchRequest = (request: Request, init?: RequestInit) => Promise<Response>

export interface ProxyToPostHogOptions {
  fetch?: FetchRequest
}

// Forward one /diag/* request to PostHog and return the answer from the upstream.
export async function proxyToPostHog(
  request: Request,
  {fetch: fetchImpl = fetch}: ProxyToPostHogOptions = {},
): Promise<Response> {
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response(null, {status: 405, headers: {allow: ALLOWED_METHODS.join(', ')}})
  }

  const url = new URL(request.url)
  const {host, pathname} = postHogUpstream(url.pathname)

  const upstream = new URL(url)
  // Always reach PostHog over HTTPS, whatever scheme the visitor used.
  upstream.protocol = 'https:'
  upstream.host = host
  upstream.pathname = pathname

  // A fresh Request copies method/body/headers (and streaming duplex). Forward
  // the real client IP so PostHog geolocates the visitor instead of the
  // Cloudflare PoP, and drop our site cookies, which PostHog has no use for.
  const proxied = new Request(upstream, request)
  proxied.headers.delete('cookie')
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) {
    proxied.headers.set('X-Forwarded-For', clientIp)
  }

  let response: Response
  try {
    response = await fetchImpl(proxied, {signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)})
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return new Response('Upstream timeout', {status: 504})
    }
    throw error
  }
  // The upstream must not set a cookie on this origin: analytics here are cookieless. The sandbox
  // policy gives an opaque origin to an answer that a browser opens as a page, so that page cannot
  // read the session or call this app as the visitor.
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  headers.set('content-security-policy', 'sandbox')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
