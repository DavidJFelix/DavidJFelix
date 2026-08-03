### chore(tooling): drive CI from a Turborepo graph instead of per-app path filters

The `packages/theme` extraction exposed what shared code costs the old CI model: `packages/theme/**`
had to be hand-added to 27 workflow files, every consumer grew its own
`bun install (packages/theme)` step, and nothing checked either. The next shared package would
repeat all of it, and a consumer whose filter missed a path fails silent-green.

`apps/` and `packages/` now live in one bun workspace at `workspaces/web-apps/` -- nested rather
than at the repo root, so the documented no-root-workspace rule stands as written. `biome.jsonc` and
`.oxlintrc.jsonc` moved in with them because turbo cannot hash files above its workspace root; the
repo-root config it still cannot see (`.config/mise.toml`, `.config/mise.lock`, `.oxfmtrc.json`,
`.prettierrc.json`) feeds the cache key through `bin/turbo-run.ts` as a `globalEnv` hash. Thirteen
lockfiles and thirteen `bunfig.toml` copies collapsed to one each, with `overrides` and
`trustedDependencies` hoisted to the workspace root and the `file:` theme links replaced by
workspace links.

Turborepo (pinned via mise) now owns orchestration: `mise run check` and CI run the same task graph,
and what executes is decided by the dependency graph and the cache rather than by path lists. A
`packages/theme` edit invalidates exactly the theme and its 8 consumers; a warm full check is 64/64
cached in 286ms against ~2m cold. `smoke` and `test:e2e` are declared `cache: false` -- the gates
that must actually run, never replay a hash hit.

**45 workflow files became 15.** Thirteen per-project `ci-*.yml` collapsed into one
`ci-web-apps.yml` (cached bulk with `--continue`, uncached smoke, djf.io e2e), and 20 per-app
preview/deploy workflows into two matrices driven by `turbo ls --affected`. The per-app knowledge
turbo cannot infer -- worker name, smoke routes, wrangler config, Sentry/PostHog variable suffix --
lives in one tested registry in `bin/plan-affected-apps.ts`, including a test asserting it covers
every app in the workspace. f311x (alchemy) and onvibes.org (worker + teardown) keep their own
workflows and opt out of the matrices; CI e2e stays scoped to djf.io exactly as before.

Two inconsistencies the collapse exposed got normalized: `smoke` became a package.json script in the
11 apps that had it (it was mise-only, so turbo could not see it), and djf.io's `test` script became
the plain vitest run its siblings already used. Deferred to post-merge verification: whether Depot
injects Depot Cache credentials for turbo automatically, whether `--affected` resolves on Depot
checkouts, and whether Depot's expression engine supports the `vars[format(...)]` indexing the
deploy matrix uses for per-app observability config.
