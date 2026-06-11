# Preview Deployments & Visual Testing

## Goal

Catch breakage before it ships and make production breakage readable. Every
deployed web app gets a per-PR preview deployment, smoke tests that run against
it, and screenshot testing — so "it deploys but it's broken" is visible at
review time instead of in production.

## Rationale

- f311x shipped broken (reported 2026-06-11): CI was green and the deploy
  succeeded, yet the live app doesn't work. Build-time checks (typecheck, lint,
  unit tests, build) cannot catch runtime breakage on the deployed platform.
- The bar for dependency auto-merge went up (2026-06-11): green unit checks are
  not enough; web apps need preview apps plus smoke/screenshot verification
  before a bot may merge on green. See
  [Dependency Freshness](../dependency-freshness/plan.md) Phase 5.
- The [Blog Style Improvement](../blog-style-improvement/plan.md) workflow
  wants the same artifact: a live preview URL per change for human review.

## Scope

- Per-PR preview deployments for every deployed web app (Cloudflare Workers
  preview environments; Alchemy stages for f311x, wrangler previews/versions
  for the others)
- Smoke tests that run against the preview URL (app boots, key routes respond,
  chat loop streams for f311x)
- Screenshot / visual regression tests so unintended visual changes are caught
- Production observability — the "read why it's broken" half — coordinated
  with [Sentry Integration](../sentry-integration/plan.md) and Cloudflare
  Workers logs/tail rather than duplicated here

## Implementation

### Phase 1: f311x first

f311x is broken in production right now and already has live deploy
automation — it is the proving ground.

- Diagnose and fix the current breakage (tracked in
  [f311x](../f311x/plan.md))
- Wire error visibility for the Worker (Cloudflare logs/tail and/or the f311x
  slice of Sentry Integration pulled forward) so the diagnosis isn't a one-off
- Stand up a per-PR preview stage via Alchemy
- Add a smoke test against the preview URL (page loads, chat endpoint streams)
- Add screenshot comparison

### Phase 2: Generalize

- Roll the pattern to the other deployed apps (djf.io, calendar-visualizer,
  davidjfelix.com, ravrun)
- One canonical mise task per app (e.g. `smoke`) so CI and humans share the
  same entry point, matching the Phase 3b check convention

### Phase 3: Wire into gates

- Preview + smoke + screenshot results become part of the dependency-freshness
  auto-merge bar (Phase 5 of that plan)
- Preview URLs surface on PRs for blog-style-improvement review

## Open questions

- Screenshot baseline strategy: compare the preview against production, or
  against a committed baseline?
- Tooling for visual diffs: Playwright screenshot assertions vs a dedicated
  service.
- Preview lifecycle: teardown on PR close; stage naming for Alchemy.

## Related

- [f311x](../f311x/plan.md) — first target; currently broken in prod
- [Dependency Freshness](../dependency-freshness/plan.md) — auto-merge gates
  on this project
- [Sentry Integration](../sentry-integration/plan.md) — the production
  observability half
- [Blog Style Improvement](../blog-style-improvement/plan.md) — consumer of
  preview URLs
