// Pure resolution of client observability settings from environment values.
// Split from the side-effectful bootstrap (./client.ts) so the enable/host logic
// is unit-testable without loading the SDKs. Both Sentry and PostHog stay
// disabled until their credentials are present.

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

export interface ObservabilityEnv {
  readonly sentryDsn?: string
  readonly posthogKey?: string
  readonly posthogHost?: string
}

export type SentryConfig =
  | {readonly enabled: false}
  | {readonly enabled: true; readonly dsn: string}

export function resolveSentry(env: ObservabilityEnv): SentryConfig {
  const dsn = env.sentryDsn?.trim()
  return dsn ? {enabled: true, dsn} : {enabled: false}
}

export type PostHogConfig =
  | {readonly enabled: false}
  | {readonly enabled: true; readonly key: string; readonly host: string}

export function resolvePostHog(env: ObservabilityEnv): PostHogConfig {
  const key = env.posthogKey?.trim()
  if (!key) return {enabled: false}
  return {enabled: true, key, host: env.posthogHost?.trim() || DEFAULT_POSTHOG_HOST}
}
