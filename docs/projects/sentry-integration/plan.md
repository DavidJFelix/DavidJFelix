# Sentry Integration

## Goal

Wire Sentry into every app in the repo for crash and error monitoring.

## Status

**Active — client-side wired fleet-wide; pending activation** (2026-06-21). Error monitoring is in
all eleven apps' clients, no-op until a DSN is set; turning it on (projects + DSNs + deploy env) is a
human task — #261. **Worker-side error visibility is deferred** — the original f311x driver — because
TanStack Start on Cloudflare has no clean worker-entry wrap on the installed version and the meta-SDK
breaks workerd (getsentry/sentry-javascript#20038); it pairs with f311x's real-model work. See the
2026-06-21 progress note.

## Scope

Every deployed app: f311x first, then djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the
domain sites (onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog) — plus new sites
as they come up.

- Per-app Sentry project, DSN, source maps, release tagging
- Confirm coverage works on the Cloudflare Workers runtime (workerd) — the f311x integration settles
  the Worker pattern the others reuse
