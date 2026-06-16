# Preview Deployments & Visual Testing

## Goal

Catch breakage before it ships and make production breakage readable. Every deployed web app gets a
per-PR preview deployment, smoke tests that run against it, and screenshot testing — so "it deploys
but it's broken" is visible at review time instead of in production.

## Rationale

- f311x shipped broken (reported 2026-06-11): CI was green and the deploy succeeded, yet the live
  app doesn't work. Build-time checks (typecheck, lint, unit tests, build) cannot catch runtime
  breakage on the deployed platform.
- The bar for dependency auto-merge went up (2026-06-11): green unit checks are not enough; web apps
  need preview apps plus smoke/screenshot verification before a bot may merge on green. See
  [Dependency Freshness](../dependency-freshness/plan.md) Phase 5.
- The [Blog Style Improvement](../blog-style-improvement/plan.md) workflow wants the same artifact:
  a live preview URL per change for human review.

## Scope

- Per-PR preview deployments for every deployed web app (Cloudflare Workers preview environments;
  Alchemy stages for f311x, wrangler previews/versions for the others)
- Smoke tests that run against the preview URL (app boots, key routes respond, chat loop streams for
  f311x)
- Screenshot / visual regression tests so unintended visual changes are caught
- Production observability — the "read why it's broken" half — coordinated with
  [Sentry Integration](../sentry-integration/plan.md) and Cloudflare Workers logs/tail rather than
  duplicated here

## Implementation

### Phase 1: f311x first

f311x already has live deploy automation — it is the proving ground.

- [x] Diagnose and fix the current breakage (done 2026-06-14; see [f311x](../f311x/plan.md))
- [x] Stand up a per-PR preview stage via Alchemy (stage `pr-<N>`, `bin/deploy-preview.ts`; non-prod
      stages get no custom domain) — 2026-06-16
- [x] Add a smoke test against the preview URL — reuses `bin/smoke-test.ts` (`SMOKE_URLS=<preview>`)
      for hydration + chat-echo — 2026-06-16
- [x] Add screenshot comparison — Playwright `toHaveScreenshot` with committed Linux/chromium
      baselines (`src/routes/index.e2e.test.ts`) — 2026-06-16
- [x] Wire it into CI — `.github/workflows/cd-preview-f311x.yml` deploys on every PR touching
      `apps/f311x`, smokes + screenshots the preview, comments the URL, and tears the stage down on
      close — 2026-06-16
- [ ] Wire error visibility for the Worker (Cloudflare logs/tail and/or the f311x slice of Sentry
      Integration pulled forward) so the diagnosis isn't a one-off — deferred to the Sentry slice

### Phase 2: Generalize

- Roll the pattern to the other deployed apps (djf.io, calendar-visualizer, davidjfelix.com, ravrun)
- One canonical mise task per app (e.g. `smoke`) so CI and humans share the same entry point,
  matching the Phase 3b check convention

### Phase 3: Wire into gates

- Preview + smoke + screenshot results become part of the dependency-freshness auto-merge bar (Phase
  5 of that plan)
- Preview URLs surface on PRs for blog-style-improvement review

## Open questions

Resolved for Phase 1 (2026-06-16):

- **Screenshot baseline**: committed baseline, not compare-against-production — deterministic and
  reviewable in the diff. Baselines are Linux/chromium-rendered (matching ubuntu CI) and regenerated
  with `pnpm run test:e2e:update`.
- **Visual-diff tooling**: Playwright `toHaveScreenshot`, matching djf.io's Playwright suite — no
  dedicated service.
- **Preview lifecycle**: stage `pr-<N>`; auto `alchemy destroy` on PR close.

Still open (Phase 2):

- Generalizing previews to apps that deploy via wrangler (not Alchemy) — the URL-resolution +
  teardown shape will differ from f311x's.
- Fork PRs lack secrets, so their preview job fails; revisit if external contributions ever matter
  (do not reach for `pull_request_target`).

## Related

- [f311x](../f311x/plan.md) — first target; currently broken in prod
- [Dependency Freshness](../dependency-freshness/plan.md) — auto-merge gates on this project
- [Sentry Integration](../sentry-integration/plan.md) — the production observability half
- [Blog Style Improvement](../blog-style-improvement/plan.md) — consumer of preview URLs
