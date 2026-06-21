import {type ObservabilityEnv, resolvePostHog, resolveSentry} from './config'

// Starts client-side error monitoring (Sentry) and product analytics (PostHog).
// Reads Vite's statically-replaced client env, and starts each integration only
// when configured. The SDKs are imported dynamically so they stay out of the
// SSR/worker bundle and load only in the browser. Invoked from src/router.tsx,
// client-side only.
export function initClientObservability(): void {
  const env: ObservabilityEnv = {
    sentryDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
    posthogKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
    posthogHost: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  }

  const sentry = resolveSentry(env)
  if (sentry.enabled) {
    void import('@sentry/react').then((Sentry) => {
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
