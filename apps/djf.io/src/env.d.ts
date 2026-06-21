/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Client-exposed observability config. All optional: each integration stays off
// until its value is provided at build time, so the app runs uninstrumented in
// dev and in any deploy where the vars aren't set.
interface ImportMetaEnv {
  readonly PUBLIC_SENTRY_DSN?: string
  readonly PUBLIC_POSTHOG_KEY?: string
  readonly PUBLIC_POSTHOG_HOST?: string
}
