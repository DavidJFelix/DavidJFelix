// Pure resolution of client observability settings from build-time env. Split
// from the side-effectful bootstrap (./client.ts) so the enable logic is
// unit-testable without loading the SDKs. Both Sentry and PostHog stay disabled
// until their public credential is present.

export interface ObservabilityEnv {
  readonly sentryDsn?: string
  readonly posthogKey?: string
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
  | {readonly enabled: true; readonly key: string}

export function resolvePostHog(env: ObservabilityEnv): PostHogConfig {
  const key = env.posthogKey?.trim()
  return key ? {enabled: true, key} : {enabled: false}
}
