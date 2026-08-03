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

## Open -- verify after merge

1. **Does Depot inject Depot Cache credentials for turbo?** The docs say Depot Cache is "built in
   with no configuration required" on Depot CI, but that is unverified here. If the first runs show
   no remote cache hits, set `TURBO_API` / `TURBO_TOKEN` / `TURBO_TEAM` (step-scoped -- ghalint 006
   forbids secrets in job env). CI is correct either way; without it, just slower.
2. **Does `turbo --affected` resolve on Depot checkouts?** Both plan jobs use `fetch-depth: 0` and
   pass explicit `TURBO_SCM_BASE`/`TURBO_SCM_HEAD`; `isUsableScmBase` drops git's all-zero sentinel
   so a first push falls back to turbo's default rather than failing.
3. **Does Depot's expression engine support `vars[format(...)]` indexing?** The deploy matrix
   resolves each app's Sentry DSN and PostHog key that way. Standard GitHub Actions syntax, but if
   Depot does not support it the failure is quiet -- apps would deploy without observability config.
   Check the first deploy's build log.
4. **First Renovate PR against the single lockfile** (also open on bun-migration).
5. **Watch the first preview and deploy cycles** end to end before trusting the matrices.
6. **One unexplained `onvibes.org#lint` failure**, seen once during a full check and not reproduced
   in four subsequent runs (three targeted, one full cold). Both linters pass standalone and the
   app's generated trees are all gitignored, so the obvious lint-reads-a-concurrent-build race does
   not fit. Turbo runs `lint` and `build` concurrently within a package where the old CI gave them
   separate runners, so a filesystem race is still the best hypothesis. If it recurs, the fix is a
   `dependsOn` edge from `lint` to `build` for that app -- do not add it speculatively.

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
