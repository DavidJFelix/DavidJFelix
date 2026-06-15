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

### Phase 1 -- f311x smoke -> pre-merge (DONE 2026-06-14)

`bin/smoke-checks.ts` holds the shared checks; `bin/smoke-test.ts` (CD, prod
URLs) and `bin/smoke-local.ts` (pre-merge) both use them. `mise run smoke`
builds, boots the production server bundle under workerd via `wrangler dev`, and
runs the gate against it -- high fidelity (the real Workers runtime) and
deterministic (echo stub, no secrets). Wired as a CI job on PRs in
ci-f311x.yml. The gate stays URL-parameterized (`SMOKE_URLS`), so it can later
point at a per-PR preview deploy with no rework.

### Phase 2 -- Generalize the smoke pattern (DONE 2026-06-14)

Documented the `smoke` task contract in CLAUDE.md (Testing Conventions ->
Runtime checks) and rolled it to the deployed apps that lacked a runtime gate:
calendar-visualizer and davidjfelix.com (static Astro -> `astro preview`) and
ravrun (Vite SPA -> `vite preview`). Each gets a `bin/smoke-local.ts`, a `smoke`
mise task (depends on `build`), and a `smoke` CI job. djf.io already has a
Playwright e2e suite as its runtime gate, so it keeps that instead of a
duplicate smoke task. Apps that run bun scripts but lacked `@types/bun` got it
added, with a `/// <reference types="bun" />` in the script (the reliable
cross-tsconfig way to pull the global in).

### Phase 3 -- Backfill real unit tests (DONE 2026-06-14)

djf.io's blog list / tag logic -- date sort, tag collection, tag counts, tag
filtering, date formatting -- was duplicated inline across rss.xml, blog/index,
blog/tags/* and the BlogPost layout. Extracted it into a pure, structurally
typed `src/lib/blog.ts`, refactored all five call sites to use it, and covered
it with `src/lib/blog.test.ts` (11 tests). The extracted code is the code that
runs, so the tests guard real regressions (feed / index / tag ordering, tag-page
popularity, date display). djf.io now has 44 passing unit tests; build still
green (17 pages). calendar-visualizer's core (`getCalendarDisplayState`) was
already well covered (11 tests); its only gap is the component-local
`getDayVariant`, left as a low-value follow-up.

### Phase 4 -- Repo-wide test + coverage gate

A root aggregator to run all app tests, plus coverage thresholds, so quality
cannot silently regress as code lands.

## Open questions

- ~~Local boot for f311x smoke?~~ Resolved (Phase 1): `vite preview` is
  static-only and the built `dist/server/server.js` is a Worker `fetch` module,
  so the boot is `wrangler dev` on the built worker (workerd).
- Coverage tooling and thresholds (Phase 4).
- Screenshot / visual-regression baseline strategy -- deferred to
  preview-deployments.
- pnpm `verify-deps-before-run` aborts (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`)
  when a task runs with no TTY and `node_modules` has drifted, so `mise run <task>`
  fails in a web session unless `CI=true` is set (CI and the SessionStart hook set
  it; manual runs do not). Durable fix candidates: a root `.npmrc`
  `confirm-modules-purge=false`, or pinning the `latest`-tagged dev deps that drift.

## Related

- [preview-deployments](../preview-deployments/plan.md) -- preview infra; smoke
  results feed its auto-merge gate
- [sentry-integration](../sentry-integration/plan.md) -- the diagnosis half
- [dependency-freshness](../dependency-freshness/plan.md) -- auto-merge bar
  consumes smoke + preview verification
