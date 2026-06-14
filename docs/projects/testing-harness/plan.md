# Testing Harness & Code-Quality Safety Net

## Goal

A layered, fast safety net so changes across the monorepo can be made and
verified quickly and confidently -- unit -> smoke -> e2e -> coverage -- and so
those checks actually run inside Claude Code on the web, not only in GitHub CI.

## Rationale

- The test *scaffolding* already exists (every app has a Vitest config and a
  `test` mise task wired into CI), but 7 of 11 apps are empty `passWithNoTests`
  placeholders and only djf.io has an e2e layer. The one runtime safety net
  (f311x's smoke test) runs post-deploy only.
- A fresh web container had neither the mise toolchain nor any app's
  `node_modules`, so a web session could not run a single check or boot an app
  -- every verification round-tripped through CI. That is the primary drag on
  iteration speed.
- f311x shipped green-CI-but-broken (2026-06-11); build-time checks cannot catch
  runtime breakage. Pulling smoke checks earlier (pre-merge) is the fix.

This project complements, rather than duplicates:

- [preview-deployments](../preview-deployments/plan.md) -- owns the preview
  *infrastructure* and visual regression. This project's smoke harness is built
  URL-parameterized so the same task points at a local boot now and a preview
  URL later.
- [sentry-integration](../sentry-integration/plan.md) -- owns the *diagnosis*
  half (why it broke). Smoke proves *that* it broke; Sentry says *why*.

## Phases

### Phase 0 -- Web-session bootstrap (DONE 2026-06-14)

A `SessionStart` hook (`.claude/hooks/session-start.ts`, bun) installs the
mise-pinned toolchain and every app's dependencies on a fresh web container, so
mise tasks (typecheck / lint / format / test / build) and smoke boots work the
same way they do in CI. Sync mode.

### Phase 1 -- f311x smoke -> pre-merge

Pull f311x's existing post-deploy smoke gate (`bin/smoke-test.ts`) into a
canonical `mise run smoke` task that boots the app locally and runs the same
checks, plus a CI job on PRs. Deterministic (echo stub, no secrets). Refactor
the smoke checks into a reusable module so prod (CD) and local/preview (CI)
share one implementation.

### Phase 2 -- Generalize the e2e/smoke pattern

Promote the f311x smoke and djf.io Playwright setups into one documented
convention (the `smoke` task contract + a short testing guide), then roll it to
the other deployed apps (djf.io, calendar-visualizer, davidjfelix.com, ravrun).

### Phase 3 -- Backfill real unit tests

Replace empty `passWithNoTests` placeholders with meaningful unit tests where
logic exists (djf.io content config / SEO, calendar-visualizer state).

### Phase 4 -- Repo-wide test + coverage gate

A root aggregator to run all app tests, plus coverage thresholds, so quality
cannot silently regress as code lands.

## Open questions

- Does `vite preview` serve the f311x worker (SSR + chat endpoint) locally, or
  is `wrangler dev` needed for the smoke boot? (Phase 1 spike.)
- Coverage tooling and thresholds (Phase 4).
- Screenshot / visual-regression baseline strategy -- deferred to
  preview-deployments.

## Related

- [preview-deployments](../preview-deployments/plan.md) -- preview infra; smoke
  results feed its auto-merge gate
- [sentry-integration](../sentry-integration/plan.md) -- the diagnosis half
- [dependency-freshness](../dependency-freshness/plan.md) -- auto-merge bar
  consumes smoke + preview verification
