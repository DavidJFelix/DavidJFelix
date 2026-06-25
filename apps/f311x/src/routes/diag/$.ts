import {createFileRoute} from '@tanstack/react-router'
import {postHogUpstream} from '@/lib/posthog-proxy'

// Reverse-proxies /diag/* to PostHog at request time so analytics ride this
// first-party origin instead of *.posthog.com (which content blockers drop).
// Runs in the worker; the client SDK is pointed here in src/observability/client.

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

export const Route = createFileRoute('/diag/$')({
  server: {
    handlers: {
      ANY: ({request}) => proxyToPostHog(request),
    },
  },
})
