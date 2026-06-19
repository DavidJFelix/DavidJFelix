# PostHog Integration

## Goal

Wire PostHog into every app in the repo for product analytics.

## Status

**Active — full-fleet rollout** (promoted 2026-06-18). Runs back-to-back with the Sentry rollout —
same app set, similar shape — so share patterns (init, Worker runtime handling, env/secret wiring).

## Scope

Every deployed app: djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the domain sites
(onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog), plus new sites as they come
up.

- Per-app project, key handling, event taxonomy
- Confirm coverage on the Cloudflare Workers runtime (workerd)

## Related

- [Sentry Integration](../sentry-integration/plan.md) — parallel observability rollout; share patterns where possible
