/// <reference types="vite/client" />

// Client-exposed observability config. Optional: each integration stays off until
// its value is provided at build, so the app runs uninstrumented in dev and in any
// deploy where the vars aren't set.
interface ImportMetaEnv {
  readonly VITE_PUBLIC_SENTRY_DSN?: string
  readonly VITE_PUBLIC_POSTHOG_KEY?: string
}
