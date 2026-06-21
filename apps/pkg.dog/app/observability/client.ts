import {type ObservabilityEnv, resolvePostHog, resolveSentry} from './config'

// Starts client-side error monitoring (Sentry) and product analytics (PostHog).
// Invoked from a Nuxt .client.ts plugin (browser-only), which passes the values
// from runtimeConfig.public. The SDKs are imported dynamically and only when
// configured, so a build without credentials never fetches them.
export function initClientObservability(env: ObservabilityEnv): void {
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
