import {withSentry} from '@sentry/cloudflare'
import {INGEST_PREFIX, postHogUpstream} from './lib/posthog-proxy'
import {forwardEnvelope, SENTRY_TUNNEL_ROUTE} from './lib/sentry-tunnel'

// ravrun is a static SPA; this worker exists only to host the same-origin
// observability relay in front of the built assets -- the PostHog reverse-proxy
// at /diag and the Sentry tunnel at /bugs -- so ad/tracker blockers can't drop
// analytics/errors. Every other request is served straight from the ASSETS
// binding (the built SPA, with single-page-application fallback for client
// routes). withSentry captures unhandled errors thrown in the relay; both it and
// the tunnel's project pin read VITE_PUBLIC_SENTRY_DSN -- inlined at build, the
// same value the client uses -- and no-op until it's set.

interface Env {
  ASSETS: {fetch: (request: Request) => Promise<Response>}
}

// Cap how long we wait on PostHog so a stalled upstream can't pin the worker
// until the platform deadline; past this we abort and return a clean 504.
const UPSTREAM_TIMEOUT_MS = 10_000

async function proxyToPostHog(request: Request): Promise<Response> {
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
    response = await fetch(proxied, {signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)})
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return new Response('Upstream timeout', {status: 504})
    }
    throw error
  }
  // Defense-in-depth: never let the upstream plant a cookie on this origin --
  // analytics here are deliberately cookieless.
  if (!response.headers.has('set-cookie')) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const {pathname} = new URL(request.url)
    if (pathname === SENTRY_TUNNEL_ROUTE) {
      return forwardEnvelope(request, {allowedDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN})
    }
    if (pathname === INGEST_PREFIX || pathname.startsWith(`${INGEST_PREFIX}/`)) {
      return proxyToPostHog(request)
    }
    return env.ASSETS.fetch(request)
  },
}

export default withSentry(
  () => ({dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN, tracesSampleRate: 1}),
  handler,
)
