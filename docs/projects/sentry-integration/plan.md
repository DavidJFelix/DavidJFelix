# Sentry Integration

## Goal

Wire Sentry into every app in the repo for crash and error monitoring.

## Status

**Active — full-fleet rollout** (promoted 2026-06-18). **f311x leads**: its plan calls for Worker
error visibility, so it's the first integration and the proving ground. Per-PR preview deploys now
exist (2026-06-17) as a place to validate instrumentation before merge. **djf.io client-side landed
(2026-06-22)**: it's a fully static site, so it gets client-only instrumentation (errors + tracing);
apps with a real runtime add the Worker/server half on top.

## Scope

Every deployed app: f311x first, then djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the
domain sites (onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog) — plus new sites
as they come up.

- Per-app Sentry project, DSN, source maps, release tagging
- Per-app split: static sites get client-only instrumentation; apps with a Worker runtime also wrap
  the server (`@sentry/cloudflare`)
- Confirm coverage works on the Cloudflare Workers runtime (workerd) — the f311x integration settles
  the Worker pattern the others reuse
