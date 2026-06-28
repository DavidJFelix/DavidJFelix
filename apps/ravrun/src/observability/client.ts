import {INGEST_PREFIX} from '../lib/posthog-proxy'
import {SENTRY_TUNNEL_ROUTE} from '../lib/sentry-tunnel'
import {resolvePostHog, resolveSentry} from './config'

// Starts client-side error monitoring (Sentry) and product analytics (PostHog),
// each only when configured. Both ride a same-origin relay so ad/tracker blockers
// can't drop them: Sentry envelopes tunnel through /bugs, PostHog traffic proxies
// through /diag (both served by the worker, src/worker.ts). The SDKs are imported
// dynamically so they load on demand. Invoked from src/main.tsx (the SPA entry,
// browser-only).
//
// Each integration is gated on its inlined VITE_PUBLIC_* literal so Vite
// dead-code-eliminates the dynamic import -- and the SDK chunk -- in keyless
// builds: dev/CI/preview ship zero vendor code. resolve* re-checks (and trims) at
// runtime.
export function initClientObservability(): void {
  if (import.meta.env.VITE_PUBLIC_SENTRY_DSN) {
    const sentry = resolveSentry({sentryDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN})
    if (sentry.enabled) {
      void import('@sentry/react').then((Sentry) => {
        Sentry.init({
          dsn: sentry.dsn,
          environment: import.meta.env.MODE,
          integrations: [Sentry.browserTracingIntegration()],
          tracesSampleRate: 1,
          // Relay envelopes through our own origin (src/worker.ts) so blockers
          // that drop *.ingest.sentry.io can't drop real-user errors.
          tunnel: SENTRY_TUNNEL_ROUTE,
        })
      })
    }
  }

  if (import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
    const posthog = resolvePostHog({posthogKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY})
    if (posthog.enabled) {
      void import('posthog-js').then(({default: ph}) => {
        ph.init(posthog.key, {
          // Same-origin reverse proxy (src/worker.ts): events and the lazily
          // loaded SDK assets travel through /diag on this domain, dodging
          // blockers that drop *.posthog.com. ui_host keeps the toolbar on PostHog.
          api_host: `${location.origin}${INGEST_PREFIX}`,
          ui_host: 'https://us.posthog.com',
          // Cookieless and storage-free, so no consent banner is required.
          persistence: 'memory',
          person_profiles: 'identified_only',
          autocapture: false,
          capture_pageview: true,
          capture_pageleave: true,
          disable_session_recording: true,
        })
      })
    }
  }
}
