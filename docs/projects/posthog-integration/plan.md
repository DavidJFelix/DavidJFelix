# PostHog Integration

## Goal

Wire PostHog into every app in the repo for product analytics.

## Status

**Active — client-side wired fleet-wide; pending activation** (2026-06-21). `posthog-js` analytics is
in all eleven apps' clients, no-op until a project key is set; turning it on (project + key + deploy
env) is a human task — #261. Shipped back-to-back with the Sentry rollout, sharing the same
`observability/` module and env wiring. Reverse-proxy hardening (anti-adblock) is deferred. See the
2026-06-21 progress note.

## Scope

Every deployed app: djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the domain sites
(onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog), plus new sites as they come
up.

- Per-app project, key handling, event taxonomy
- Confirm coverage on the Cloudflare Workers runtime (workerd)

## Related

- [Sentry Integration](../sentry-integration/plan.md) — parallel observability rollout; share patterns where possible
