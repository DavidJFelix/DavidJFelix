/// <reference types="vite/client" />

// Client-exposed observability config. Optional: each integration stays off until
// its value is provided at build, so the SPA runs uninstrumented in dev and in any
// deploy where the vars aren't set. The worker (src/worker.ts) reads the same
// VITE_PUBLIC_SENTRY_DSN, inlined at build by @cloudflare/vite-plugin.
interface ImportMetaEnv {
  readonly VITE_PUBLIC_SENTRY_DSN?: string
  readonly VITE_PUBLIC_POSTHOG_KEY?: string
}
