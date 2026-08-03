# depot-caching-strategy

Replace hand-maintained CI path filters with graph-computed work selection and content-addressed
caching: one bun workspace at `workspaces/web-apps/`, Turborepo as the task graph, and Depot Cache
as the remote cache. Executed 2026-08-02; what remains is post-merge verification on Depot.

## Why

The old CI model assumed every project was independent: each `ci-<app>.yml` triggered on
`apps/<app>/**` plus a hand-copied list of shared configs. The `packages/theme` extraction showed
what shared code does to that model -- `packages/theme/**` had to be hand-added to 27 workflow
files, every consumer workflow grew its own `bun install (packages/theme)` step, and the package
needed its own `ci-theme.yml`. Nothing checked any of it, and the next package would repeat all of
it. A consumer whose filter missed a path fails silent-green, exactly the rot
[github-actions-style.md](../../contributing/github-actions-style.md) warns about.

Graph-based selection inverts the maintenance burden: affected work is computed from the dependency
graph bun and Turborepo already know. Caching is what makes coarse triggers safe -- workflows fire
on the whole workspace because unaffected work resolves as a cache hit instead of a re-run.

## What shipped

- **Nested workspace root.** `apps/` and `packages/` moved to `workspaces/web-apps/`, joined by
  `biome.jsonc` and `.oxlintrc.jsonc` (turbo cannot hash files above its workspace root, so the
  configs that shape task results had to come along). The repo-root "no workspace here" rule stands
  as written. Repo-root config turbo still cannot see (`.config/mise.toml`, `.config/mise.lock`,
  `.oxfmtrc.json`, `.prettierrc.json`) feeds the cache key through `bin/turbo-run.ts`, which hashes
  those files into `REPO_CONFIG_HASH` -- declared in `turbo.json`'s `globalEnv`.
- **One bun workspace.** Root `package.json` with `workspaces: ["apps/*", "packages/*"]`, one
  `bun.lock` replacing thirteen, one `bunfig.toml` replacing thirteen, and `overrides` +
  `trustedDependencies` hoisted (verified no cross-app conflicts first). The
  `file:../../packages/theme` links became workspace links.
- **Turborepo** pinned via mise's npm backend. Tasks: `typecheck`, `lint`, `format`, `build`,
  `test`, plus `smoke` and `test:e2e` with `cache: false` -- the gates that must actually execute.
  `mise run check` / `mise run test` now wrap turbo; `bin/run-app-tasks.ts` (sequential fan-out) is
  deleted.
- **CI collapsed** from 13 per-project workflows to one `ci-web-apps.yml` (three jobs: the cached
  bulk with `--continue`, the uncached smoke gate, and djf.io's e2e). CD collapsed from 20 per-app
  preview/deploy workflows to `cd-preview-web-apps.yml` + `cd-deploy-web-apps.yml`, both driven by a
  plan job running `turbo ls --affected`. **45 workflow files became 15.**
- **A registry, not YAML, per app.** `bin/plan-affected-apps.ts` holds what turbo cannot infer
  (worker name, smoke routes, wrangler config, Sentry/PostHog variable suffix) with tests --
  including one asserting the registry covers every app in the workspace, so a new app cannot
  silently miss deploys.
- **Normalized two inconsistencies** the collapse exposed: `smoke` became a package.json script in
  all 11 apps that had it (it was mise-only, so turbo could not see it), and djf.io's `test` script
  became the vitest run its 11 siblings already used.
- **Smoke runs serially** (`mise run smoke` -> `--concurrency=1`). Collapsing per-app jobs onto one
  runner put eleven real production servers (workerd, node, nuxt) on the same machine: three pairs
  of apps also shared a default port, and even after making every port unique they starved each
  other past the 60s readiness timeout. The per-app workflows hid both by giving each app its own
  runner. Serial is the faithful equivalent -- and cheap, since the builds it depends on are cached
  (~25s warm).

## Verified locally

- Full `mise run check` green across all 13 projects (64 tasks).
- Warm re-run: **64/64 cached, 286ms** (`FULL TURBO`) against ~2m11s cold.
- Touching `packages/theme` invalidates exactly the theme plus its 8 consumers; the other apps stay
  cached. That is the relationship 27 workflow files used to assert by hand.
- `bun install` at the workspace root still runs each app's `prepare` (panda codegen, svelte-kit
  sync) -- confirmed by deleting a generated `styled-system/` and reinstalling.
- actionlint, ghalint, and pinact clean on all 15 workflows; zizmor clean offline (its
  impostor-commit audit needs GitHub API access the sandbox lacks).
- `bun test bin/` green, including the affected-planner tests.

## Verified on Depot (PR #406)

- **`turbo ls --affected` resolves on Depot checkouts** and the dynamic matrix expands to exactly
  the registered apps -- 9 previews, each posting a live URL with green smoke and screenshots.
  onvibes.org's own preview workflow passes too.
- **The collapsed `ci-web-apps` jobs all pass**: the turbo bulk, the serial smoke gate, and djf.io's
  e2e. So does every repo-wide gate (spell, docs, actions-lint, repo).
- **Depot Cache works with turbo out of the box.** The job log prints `Remote caching enabled` with
  no `TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM` plumbing, and a fresh runner replays builds it never
  ran. That is what surfaced the `outputs` bug below -- locally the artifacts were always already on
  disk, so only a remote hit on a clean machine could expose it.
- Three failures this migration caused, all found by CI and fixed:
  1. the preview composite actions were never re-pointed off `packages/theme` (75f4a7b);
  2. the smoke gate could not run eleven production servers on one runner -- shared default ports
     plus contention (91c6a6b);
  3. **`turbo.json`'s `outputs` was incomplete**, listing only `dist/**` and `.svelte-kit/**`. Apps
     that build elsewhere (`.output` for nuxt/nitro, `dist-flue` for flue, `.tanstack`, `.vinxi`)
     cached no artifacts at all, so a cache hit restored logs and an empty build tree. Local runs
     never caught it because the artifacts were already on disk; only a fresh runner exposes it.
     This was the most dangerous of the three -- the deploy matrix runs `turbo build` before
     `wrangler deploy`, so a cache hit would have shipped a stale or empty bundle to production.
     Turbo had been warning "no output files found for task X#build" the whole time; that warning
     means a correctness bug, not noise.

     It took two passes to get the list right. The first fix covered the obvious build directories
     and left `.wrangler/deploy/config.json` out -- a file the Cloudflare vite plugin writes during
     build and that `vite preview` refuses to start without. The tell was that ravrun failed while
     revision.city passed _in the same run_: revision.city's build was a cache miss (real build, so
     the file existed) and ravrun's was a cache hit (restored without it). Same bug, different
     directory. `.wrangler/state/` is deliberately excluded -- that is miniflare runtime state from
     the prerender step, not a build artifact.
- `CD Preview f311x` failed once and then passed, and **the failure was not from this work**:
  alchemy's shared Cloudflare state store reported schema v10 while the repo's exact-pinned
  `alchemy@2.0.0-beta.61` expects v7, and the store's HTTP API 500'd during reconciliation, before
  the f311x build or the `pr-406` stage was touched.

  **Why it recovered is unknown.** No code changed between the failing and passing runs: `main` did
  not move, and this branch never touches the alchemy pin. So the state store's deployed state
  changed out of band -- plausibly the failed run's own "upgrading..." step partially applied and
  the next run found something it could reconcile. Treat the f311x preview as possibly flaky until
  the v7/v10 drift is deliberately resolved; the likely resolution here is bumping the exact pin to
  an alchemy that speaks v10, which is coupled to the `@effect/platform-node-shared` cap in the
  workspace root `overrides` (that cap exists because effect `beta.97` removed `Schedule.either`,
  which alchemy `beta.61` still calls).

## Open -- still unverified

1. **Does Depot's expression engine support `vars[format(...)]` indexing?** The deploy matrix
   resolves each app's Sentry DSN and PostHog key that way. It only exercises on a push to main, so
   this PR cannot confirm it, and the failure mode is quiet -- apps would deploy without
   observability config rather than failing. Check the first deploy's build log.
2. **First Renovate PR against the single lockfile** (also open on bun-migration).
3. **One unexplained `onvibes.org#lint` failure**, seen once locally and not reproduced in four
   subsequent runs, nor in CI. Turbo runs `lint` and `build` concurrently within a package where the
   old CI gave them separate runners, so a filesystem race is the best hypothesis. If it recurs, the
   fix is a `dependsOn` edge from `lint` to `build` -- do not add it speculatively.

## Deliberately not done

- **CI e2e scope unchanged.** Only djf.io runs Playwright in CI, as before; the other 10 suites run
  against deployed previews. Widening that is a scope change, not a migration detail.
- **f311x and onvibes.org keep their own workflows.** f311x deploys through alchemy rather than
  wrangler; onvibes.org's preview is a real worker with a teardown. Genuinely different shapes, not
  one extra step -- they opt out via `preview: 'none'` / `deploy: 'none'`.
- **Historical project docs keep their old paths.** Progress notes and other plans record what was
  true when written, same convention the cspell and oxlintrc renames followed. Durable docs
  (AGENTS.md, CONTEXT-MAP.md, CONTRIBUTING.md, the style guides, renovate config) were re-pointed.

## Relationship to other projects

- **ci-pipeline-efficiency**: Task 1 (path-filter surgery) is superseded -- the filters are gone.
  The session-start Playwright fix stands on its own; install caching is now one workspace-rooted
  concern. Close or fold that project once this one is verified.
- **bun-migration**: this builds directly on it and shares its open "watch the first Renovate PR"
  item.
- **theme-switcher-unification**: produced `packages/theme`, the first consumer of this graph. Its
  next extraction is the real acceptance test -- it should need zero workflow edits.
