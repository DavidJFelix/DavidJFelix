# Sentry Integration

## Goal

Wire Sentry into every app in the repo for crash and error monitoring.

## Status

**Active — full-fleet rollout** (promoted 2026-06-18). **f311x leads**: its plan calls for Worker
error visibility, so it's the first integration and the proving ground. Per-PR preview deploys now
exist (2026-06-17) as a place to validate instrumentation before merge.

## Scope

Every deployed app: f311x first, then djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the
domain sites (onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog) — plus new sites
as they come up.

- Per-app Sentry project, DSN, source maps, release tagging
- Confirm coverage works on the Cloudflare Workers runtime (workerd) — the f311x integration settles
  the Worker pattern the others reuse
