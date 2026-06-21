import {type ObservabilityEnv, resolvePostHog, resolveSentry} from './config'

// Starts client-side error monitoring (Sentry) and product analytics (PostHog).
// Loaded from a client <script> (Observability.astro), so this only runs in the
// browser. The SDKs are imported dynamically and only when configured, so a
// build without credentials never fetches them. Astro exposes build-time env to
// the client only under the PUBLIC_ prefix.
export function initClientObservability(): void {
  const env: ObservabilityEnv = {
    sentryDsn: import.meta.env.PUBLIC_SENTRY_DSN,
    posthogKey: import.meta.env.PUBLIC_POSTHOG_KEY,
    posthogHost: import.meta.env.PUBLIC_POSTHOG_HOST,
  }

  const sentry = resolveSentry(env)
  if (sentry.enabled) {
    void import('@sentry/browser').then((Sentry) => {
      Sentry.init({
        dsn: sentry.dsn,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 1,
      })
    })
  }

  const posthog = resolvePostHog(env)
  if (posthog.enabled) {
    void import('posthog-js').then(({default: ph}) => {
      ph.init(posthog.key, {api_host: posthog.host, defaults: '2026-01-30'})
    })
  }
}
