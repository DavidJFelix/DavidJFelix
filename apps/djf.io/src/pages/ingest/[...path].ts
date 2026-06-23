import type {APIRoute} from 'astro'
import {postHogUpstream} from '../../lib/posthog-proxy'

// Reverse-proxies /ingest/* to PostHog at request time so analytics ride this
// first-party origin instead of *.posthog.com (which content blockers drop).
// This is the only non-prerendered route -- everything else stays static.
export const prerender = false

export const ALL: APIRoute = async ({request}) => {
  const url = new URL(request.url)
  const {host, pathname} = postHogUpstream(url.pathname)

  const upstream = new URL(url)
  // Always reach PostHog over HTTPS, whatever scheme the visitor used.
  upstream.protocol = 'https:'
  upstream.host = host
  upstream.pathname = pathname

  // A fresh Request copies method/body/headers (and streaming duplex) and has
  // mutable headers. The runtime sets Host from the upstream URL; we forward the
  // real client IP so PostHog geolocates the visitor instead of the Cloudflare
  // PoP, and drop our site cookies, which PostHog has no use for.
  const proxied = new Request(upstream, request)
  proxied.headers.delete('cookie')
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) {
    proxied.headers.set('X-Forwarded-For', clientIp)
  }

  const response = await fetch(proxied)
  // Defense-in-depth: never let the upstream plant a cookie on this origin --
  // analytics here are deliberately cookieless. PostHog doesn't set cookies on
  // these endpoints today, so only rebuild the response in the rare case it does
  // (rebuilding unconditionally would risk a body/content-encoding mismatch).
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
