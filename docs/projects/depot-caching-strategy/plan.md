# depot-caching-strategy

Replace hand-maintained CI path filters with graph-computed work selection and content-addressed
caching: a root bun workspace, Turborepo as the task graph, and Depot Cache as the remote cache.
Driven by two forces David named: shared code is now real (`packages/theme` landed 2026-08-01), and
the path-filter surface (45 workflow files, ~4,100 lines) is fragile -- a forgotten path is a silent
false green.

## Why now

The CI model assumes every project is independent: each `ci-<app>.yml` triggers on `apps/<app>/**`
plus a hand-copied list of shared configs. The theme extraction shows what shared code does to that
model: `packages/theme/**` had to be hand-added to 27 workflow files, every consumer's CI grew its
own `bun install (packages/theme)` step, and the package got its own `ci-theme.yml` -- and none of
that is checked by anything. The next package repeats all of it, and a consumer filter that misses a
new path fails silent-green, exactly the rot
[github-actions-style.md](../../contributing/github-actions-style.md) warns about ("a workflow that
does not trigger is worse than no workflow at all").

Graph-based selection inverts the maintenance burden: affected work is computed from the dependency
graph bun and Turborepo already know, instead of asserted by hand in YAML. Caching is what makes the
coarse trigger safe -- workflows can fire on every change because unaffected work resolves as a
cache hit instead of a re-run.

## Why this stack

- **Turborepo over Bazel/Buck2**: the repo is a JS/TS monorepo of small apps; Bazel's hermetic rules
  for Astro/Vite/Wrangler would be a standing maintenance project with no payoff at this scale.
- **Turborepo over Nx**: Depot Cache speaks Turborepo's remote-cache API natively; Nx remote caching
  is its own product with its own account surface.
- **Turborepo works with bun**: current turbo supports bun workspaces and the text lockfile the repo
  already uses (`bun.lock`), including lockfile-aware hashing. `turbo prune` still has known rough
  edges with bun, but prune (Docker slimming) is out of scope here.
- **Depot Cache over anything self-hosted**: CI already runs on Depot. Depot Cache is included on
  every plan, pre-configured on Depot runners, and works locally with three env vars
  (`TURBO_API=https://cache.depot.dev`, `TURBO_TOKEN`, `TURBO_TEAM`).

Verified against Depot docs (2026-08-02): Depot CI supports the `workflow_call` trigger; Depot Cache
lists Turborepo as a first-class integration; the Depot CI overview states "Depot Cache is built in
with no configuration required."

## Target architecture

- **One bun workspace** covering `apps/*` + `packages/*` -- at the repo root or nested under a new
  tree like `workspaces/web-apps/` (the shape decision in "What it costs" below; the graph mechanics
  are identical). One `bun.lock` at the workspace root; the thirteen per-project lockfiles (twelve
  apps + `packages/theme`) are deleted. The `file:../../packages/theme` links become workspace
  links, per-app `trustedDependencies` consolidate at the workspace root, and the session-start
  hook's thirteen sequential installs become one `bun install`.
- **Turborepo pinned via mise's npm backend** (`"npm:turbo"`), matching how cspell/oxfmt/warden are
  managed.
- **`turbo.json`** defining the task graph: `typecheck`, `lint`, `format`, `build`, `test`,
  `test:e2e`. The per-project scripts already exist with consistent names (`packages/theme` shipped
  turbo-ready). Shared configs (`biome.jsonc`, `.oxlintrc.jsonc`, `.config/mise.toml`, ...) are
  declared once as global dependencies instead of copied into every path filter. Workspace
  dependencies do the rest: a `packages/theme` change hashes into every consumer automatically --
  the relationship maintained by hand in 27 files today. `test:e2e` runs with caching disabled --
  the smoke gate on deployed apps ([testing.md](../../contributing/testing.md)) must actually run,
  not replay a hash hit.
- **mise stays the entry point** per the scripting rule: root `mise run check` wraps
  `turbo run ...`; `bin/run-app-tasks.ts` (the current sequential fan-out) is deleted once turbo
  owns orchestration. App-level task names keep working for humans working inside one app.
- **CI collapses** from thirteen per-project `ci-*.yml` (twelve apps + theme) to one turbo-driven
  `ci.yml` with no per-project path lists. Repo-wide gates (`ci-spell.yml`, `ci-warden.yml`,
  `ci-actions-lint.yml`, `ci-repo.yml`) stay separate workflows.
- **CD previews/deploys** move to an affected-driven matrix: a small planning job runs
  `turbo ls --affected --output json` and feeds the app list to a matrix reusing the existing
  `preview-worker`/`preview-wrangler` composite actions. Per-app `cd-*` workflows keep their path
  filters until this phase lands -- deploys are the place to be conservative.

## What it costs

Decisions David must own before phase 1:

1. **Where the workspace root lives.** Two viable shapes; turbo does not require the workspace root
   to be the git root, so this is a repo-layout decision, not a tooling constraint.
   - _Repo root_: private root `package.json` with workspace globs scoped to `apps/*` +
     `packages/*`. Reverses the letter of the "no repo-root workspace" rule (AGENTS.md and the style
     guides change), though its motivation survives -- `workspaces/` trees keep their own roots and
     are never glob-matched.
   - _Nested root_: a new tree (e.g. `workspaces/web-apps/`) holding `apps/` + `packages/` with its
     own `package.json`/`bun.lock`/`turbo.json`. The rule stands as written. The costs move
     elsewhere: turbo cannot hash files outside its workspace root (`globalDependencies`/`inputs`
     globs are confined to it -- an open turborepo feature request, not a toggle), so the shared
     configs (`biome.jsonc`, `.oxlintrc.jsonc`, `.config/mise.toml`, ...) must move into the nested
     root to stay cache-correct, dragging the repo-root `format`/`ci-repo.yml` surface with them;
     plus a large mechanical re-point of every `apps/**` reference in workflows, hooks, docs, and
     CONTEXT-MAP.

   Either way `packages/` stops shipping as `file:` dependencies (workspace links replace them) and
   AGENTS.md changes -- the difference is whether the no-root-workspace rule flips or the directory
   tree moves. Decide in phase 0.

2. **One lockfile.** Renovate PRs converge on a single `bun.lock`. Turborepo hashes each package
   against only its slice of the lockfile, so a dep bump still invalidates only the projects that
   depend on it -- but the renovate-rollout config needs a coordinated update, and this touches the
   bun-migration project's open "watch the first Renovate PR" item.
3. **One CI status check** replaces per-project checks on PRs. Acceptable for a single-maintainer
   repo; the turbo run log still itemizes per-project results.
4. **Correctness moves from trigger-time to cache-time.** Today's failure mode is "workflow did not
   trigger"; the new one is "stale cache hit" from an under-declared input. Mitigations: turbo's
   default input set is every file in the package (allowlists are the exception, not the rule),
   shared configs are global dependencies, and deploy/e2e tasks never cache.

## Phases

0. **Spikes, then sign-off.** (a) Confirm Depot CI injects Depot Cache credentials for turbo under
   `.depot/workflows` -- "built in" is documented for the runners, verify it reaches turbo's env.
   (b) Confirm `turbo --affected` works on Depot CI checkouts (needs the base ref fetched; set
   `TURBO_SCM_BASE`/fetch depth accordingly). (c) Confirm turbo's bun.lock analysis handles this
   repo's lockfiles (all projects are on the text lockfile already). (d) Inventory per-app bun
   settings (`bunfig.toml`, `trustedDependencies`) and draft the merged root config. (e) Pick the
   workspace-root shape (repo root vs. nested) -- cost 1 below has the trade-offs.
1. **Workspace unification.** Workspace `package.json` + merged `bunfig.toml` at the chosen root (if
   nested: move `apps/` + `packages/` + shared configs in, and re-point every path reference);
   convert `file:` theme links to workspace links; delete the thirteen project lockfiles; single
   `bun install`; update `.claude/hooks/session-start.ts`; update renovate config; update AGENTS.md
   and style guides.
2. **Turborepo locally.** `turbo.json`, mise task wrappers, verify warm-cache runs of
   `mise run check` locally. No CI changes yet.
3. **CI collapse.** Replace the thirteen `ci-*.yml` with one turbo-driven workflow; verify remote
   cache hits on Depot; delete the per-project files, their filter lists, and the hand-added
   `packages/theme` install steps.
4. **Affected-driven CD.** Planning job + matrix for previews, then deploys.
5. **Prove the growth path.** The next extracted package (theme-switcher-unification names more
   candidates) should require zero workflow edits -- that is the acceptance test for the whole
   project.

## Relationship to other projects

- **ci-pipeline-efficiency**: supersedes Task 1 (path-filter surgery) -- trimming filter lists is
  moot once the filters are deleted. Two Task 2 items stand on their own and should proceed
  regardless: the session-start Playwright install fix, and install caching (which after phase 1
  becomes a single root-keyed cache step). Fold or close that project when this one is adopted.
- **bun-migration**: phase 1 builds directly on it and touches its open Renovate-verification item;
  sequence phase 1 after that project closes.
- **theme-switcher-unification**: its extraction produced `packages/theme`, the first real consumer
  of this plan; later extractions are phase 5's acceptance test.

## Open questions

- Does Depot CI's built-in cache cover `actions/cache` interception too, or only the native Depot
  Cache protocols? Affects whether the mise tool cache step changes.
- Turbo task shape for the two apps with Playwright snapshot bots (djf.io, forzamonica.com) -- the
  `bot-update-snapshots-*` workflows write back to branches and must stay outside the cached graph.
- Whether `format` stays per-project in turbo or becomes one repo-wide task (Prettier/oxfmt scopes
  differ from the per-project linters).
