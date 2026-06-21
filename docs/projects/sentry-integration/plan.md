# Sentry Integration

## Goal

Wire Sentry into every app in the repo for crash and error monitoring.

## Status

**Active — client + worker wired; pending activation** (2026-06-21). Client error monitoring is in all
eleven apps; the four TanStack Start apps (f311x, forzamonica.com, revision.city, startchi.com) also
wrap their worker handler with `@sentry/cloudflare` (`withSentry` in `src/server.ts`) for server-side
error visibility — the original f311x driver. Both stay no-op until a DSN is set; turning it on
(projects + client DSNs + worker `SENTRY_DSN` + deploy env) is a human task — #261. See the
2026-06-21 progress note.

## Scope

Every deployed app: f311x first, then djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the
domain sites (onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog) — plus new sites
as they come up.

- Per-app Sentry project, DSN, source maps, release tagging
- Confirm coverage works on the Cloudflare Workers runtime (workerd) — the f311x integration settles
  the Worker pattern the others reuse
