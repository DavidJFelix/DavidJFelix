# PostHog Integration

## Goal

Wire PostHog into every app in the repo for product analytics.

## Status

**Active — blocked on activation.** The **full-fleet rollout landed 2026-06-25** (branch
`claude/pensive-euler-w2a96w`, see [progress](2026-06-25-progress.md)): all 11 apps now
reverse-proxy PostHog through the same-origin `/diag` path with cookieless `posthog-js`, gated on
the project key. Everything is **dark** until the US project(s) exist and the per-app key vars are
set (issue #261; #95 covers org/project creation). After that the project closes — capture in
`docs/changelog/` and delete this directory.

History: the djf.io pilot (2026-06-23) established the same-origin reverse-proxy + cookieless
pattern that the rest of the fleet was templatized from.

## Scope

Every deployed app: djf.io, calendar-visualizer, ravrun, davidjfelix.com, and the domain sites
(onvibes.org, revision.city, startchi.com, monicandavid.com, pkg.dog), plus new sites as they come
up.

- Per-app project, key handling, event taxonomy
- Confirm coverage on the Cloudflare Workers runtime (workerd)

## Related

- [Sentry Integration](../sentry-integration/plan.md) — parallel observability rollout; share
  patterns where possible
