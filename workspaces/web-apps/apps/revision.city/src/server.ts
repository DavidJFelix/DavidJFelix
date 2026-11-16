import {captureMessage, withSentry} from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'
import {scrubSentryEvent, scrubSentrySpan, scrubServerBreadcrumb} from './lib/telemetry-scrub'
import {resolveSentryEnvironment} from './observability/config'
import {reportServerErrorResponse} from './observability/server-error-response'
import {site} from './site'

// The Workflow class must be a named export of the worker's main module.
export {ReviewWorkflow} from './reviews/review-workflow'

// Custom worker entry: wraps TanStack Start's generated handler so unhandled
// errors in SSR and server routes are captured server-side, and so are handled
// failures that answer 5xx. @sentry/cloudflare is
// workerd-native (no @sentry/node, so it sidesteps getsentry/sentry-javascript#20038);
// the client SDK is wired separately in src/observability. The DSN is the same
// VITE_PUBLIC_SENTRY_DSN inlined into the client build (no runtime var); no-op
// until it's set. `main` in wrangler.toml points
// @cloudflare/vite-plugin at this wrapper instead of @tanstack/react-start/server-entry
// directly (cloudflare/workers-sdk#11100).
export default withSentry(
  () => ({
    dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
    environment: resolveSentryEnvironment(import.meta.env.VITE_PUBLIC_DEPLOY_ENV),
    tracesSampleRate: 1,
    // Sentry gets route templates, and the URLs of outgoing calls keep only their origin.
    beforeSendSpan: (span) => scrubSentrySpan({span, origin: site.origin, otherHostUrls: 'origin'}),
    beforeSend: (event) => scrubSentryEvent({event, origin: site.origin, otherHostUrls: 'origin'}),
    beforeBreadcrumb: (breadcrumb) => scrubServerBreadcrumb({breadcrumb, origin: site.origin}),
  }),
  {
    async fetch(request) {
      const response = await handler.fetch(request)
      reportServerErrorResponse({request, response, captureMessage})
      return response
    },
  },
)
