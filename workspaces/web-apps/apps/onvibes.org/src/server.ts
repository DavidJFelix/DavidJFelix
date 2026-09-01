import {withSentry} from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'

// Custom worker entry: wraps TanStack Start's generated handler so unhandled
// errors in SSR and server routes are captured server-side. @sentry/cloudflare is
// workerd-native (no @sentry/node, so it sidesteps getsentry/sentry-javascript#20038);
// the client SDK is wired separately in src/observability. The DSN is the same
// VITE_PUBLIC_SENTRY_DSN inlined into the client build (no runtime var); no-op
// until it's set. `main` in wrangler.toml points
// @cloudflare/vite-plugin at this wrapper instead of @tanstack/react-start/server-entry
// directly (cloudflare/workers-sdk#11100).
export default withSentry(
  () => ({
    dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1,
  }),
  handler,
)
