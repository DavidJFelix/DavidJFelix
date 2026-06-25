import {defineNuxtPlugin, useRuntimeConfig} from '#imports'
import {resolvePostHog, resolveSentry} from '../../shared/config'
import {INGEST_PREFIX} from '../../shared/posthog-proxy'
import {SENTRY_TUNNEL_ROUTE} from '../../shared/sentry-tunnel'

// Client-only Nuxt plugin (.client suffix): starts Sentry error monitoring and
// PostHog analytics in the browser, each only when its credential is set. Reads
// Nuxt runtime config -- overridable at runtime by the NUXT_PUBLIC_SENTRY_DSN /
// NUXT_PUBLIC_POSTHOG_KEY Cloudflare Worker vars (issue #261) -- so toggling them
// needs no rebuild. Both ride the same-origin relay (server/routes/{diag,bugs}) so
// ad/tracker blockers can't drop them. The SDKs are imported dynamically, so a
// runtime without the vars set never fetches them.
export default defineNuxtPlugin(() => {
  const {public: pub} = useRuntimeConfig()

  const sentry = resolveSentry({sentryDsn: pub.sentryDsn})
  if (sentry.enabled) {
    void import('@sentry/browser').then((Sentry) => {
      Sentry.init({
        dsn: sentry.dsn,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 1,
        // Relay envelopes through our own origin (server/routes/bugs) so blockers
        // that drop *.ingest.sentry.io can't drop real-user errors.
        tunnel: SENTRY_TUNNEL_ROUTE,
      })
    })
  }

  const posthog = resolvePostHog({posthogKey: pub.posthogKey})
  if (posthog.enabled) {
    void import('posthog-js').then(({default: ph}) => {
      ph.init(posthog.key, {
        // Same-origin reverse proxy (server/routes/diag): events and the lazily
        // loaded SDK assets travel through /diag on this domain, dodging blockers
        // that drop *.posthog.com. ui_host keeps the toolbar on PostHog.
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
})
