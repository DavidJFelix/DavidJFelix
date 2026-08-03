import * as Sentry from '@sentry/astro'
import {SENTRY_TUNNEL_ROUTE} from './src/lib/sentry-tunnel'

// Injected at build via PUBLIC_SENTRY_DSN (see astro.config.mjs and the djf.io
// deploy workflow). Absent locally and on CI/preview builds, so Sentry stays
// disabled there -- no network, deterministic e2e and smoke.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Errors + performance tracing. No Session Replay: it's the heaviest bundle
  // and there's little to replay on a static, low-interaction blog.
  integrations: [Sentry.browserTracingIntegration()],
  // Low-traffic personal site -- sample every transaction for full visibility.
  tracesSampleRate: 1.0,
  // Relay envelopes through our own origin instead of *.ingest.sentry.io, which
  // ad/tracker blockers drop. The same-origin worker route (src/worker.ts)
  // forwards them to Sentry server-side. Relative path => no CORS preflight.
  tunnel: SENTRY_TUNNEL_ROUTE,
  environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
})
