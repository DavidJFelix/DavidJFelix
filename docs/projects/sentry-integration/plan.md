# Sentry Integration

## Goal

Wire Sentry into every app in the repo for crash and error monitoring.

## Status

**Active — blocked on activation.** The **full-fleet rollout landed 2026-06-25** (branch
`claude/pensive-euler-w2a96w`, see [progress](2026-06-25-progress.md)): all 11 apps now carry
client-side Sentry behind the same-origin `/bugs` tunnel, with server-side `withSentry` on the 4
TanStack Start apps + ravrun (deferred on the SvelteKit/Nuxt placeholders — `@sentry/node` can't run
on workerd). Everything is **dark** until the Sentry project(s) exist and the per-app DSN vars are
set (issue #261); #94 covers the org/project creation. After that the project closes — capture in
`docs/changelog/` and delete this directory.

History: f311x was the intended Worker proving ground; djf.io landed client-side first (2026-06-22)
and became the templatized pilot.

## Scope

Every deployed app: f311x first, then djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the
domain sites (onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog) — plus new sites
as they come up.

- Per-app Sentry project, DSN, source maps, release tagging
- Per-app split: static sites get client-only instrumentation; apps with a Worker runtime also wrap
  the server (`@sentry/cloudflare`)
- Confirm coverage works on the Cloudflare Workers runtime (workerd) — the f311x integration settles
  the Worker pattern the others reuse
