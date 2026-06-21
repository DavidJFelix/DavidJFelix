import {withSentry} from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'

// Custom worker entry: wraps TanStack Start's generated handler so unhandled
// errors in SSR, server routes, and the agent endpoint are captured server-side.
// @sentry/cloudflare is workerd-native (no @sentry/node, so it sidesteps
// getsentry/sentry-javascript#20038); the client SDK is wired separately in
// src/observability. No-op until the SENTRY_DSN worker var is set. Pointed at by
// `main` in wrangler.toml so @cloudflare/vite-plugin uses this wrapper rather
// than @tanstack/react-start/server-entry directly (cloudflare/workers-sdk#11100).
export default withSentry(
  (env: {SENTRY_DSN?: string}) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1,
  }),
  // @ts-expect-error server-entry's handler isn't typed as a Cloudflare ExportedHandler
  handler,
)
