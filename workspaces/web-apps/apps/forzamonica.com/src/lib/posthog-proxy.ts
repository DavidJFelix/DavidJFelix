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
