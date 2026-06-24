/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// PostHog project key, injected at build on the production deploy. Absent
// everywhere else, which is what keeps analytics off locally/CI/preview.
interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG_KEY?: string
}
