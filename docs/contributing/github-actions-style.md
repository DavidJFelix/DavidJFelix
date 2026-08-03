# GitHub Actions style guide

Conventions for the repo's workflows. They are written in GitHub Actions syntax but run on
[Depot CI](https://depot.dev) from `.depot/workflows/` (on `depot-ubuntu-latest` runners), so the
path and runner-label examples below reflect that.

## Workflow categories

Every workflow falls into exactly one of these buckets. The bucket determines the file prefix and
how the workflow is triggered.

| Category                                         | Prefix  | Triggers                                                                                                       |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| **CI** -- Continuous Integration                 | `ci-`   | `push` to `main`, `pull_request`                                                                               |
| **CD** -- Continuous Delivery                    | `cd-`   | `push` to `main` (after CI), release tags                                                                      |
| **Run** -- Manual operations                     | `run-`  | `workflow_dispatch` only                                                                                       |
| **Cron** -- Scheduled jobs                       | `cron-` | `schedule` only                                                                                                |
| **Bot** -- Event-driven third-party integrations | `bot-`  | `issue_comment`, `pull_request_review_comment`, `issues`, etc. -- typically responding to a mention or webhook |

If a workflow legitimately spans two categories, combine the prefixes in alphabetical order,
space-separated in the display name and hyphen-separated in the file name:

- A scheduled deployment is `CD CRON` (display name) / `cd-cron-*.yml` (file).
- A manually-triggered CI rerun is `CI RUN` / `ci-run-*.yml`.

Do not invent new categories beyond these. If a workflow does not fit, it is probably two workflows.

`Bot` is reserved for integrations whose trigger is a human (or other bot) reacting to repo activity
-- comment mentions, label additions, webhook callbacks. A `Bot` workflow does not gate merges and
is not on the deploy path. A workflow that automatically runs a quality check on every PR is `CI`,
not `Bot`, even if a bot posts the result.

## File naming

- All workflow files are lowercase.
- Use hyphens (`-`) as the separator -- kebab-case, per the repo-wide file naming rule in
  [file-naming.md](file-naming.md). Not underscores, not dots.
- The file name starts with the category prefix, then describes what the workflow does.

Good:

```
ci-actions-lint.yml
ci-web-apps.yml
cd-deploy-web-apps.yml
cd-preview-f311x.yml
run-rotate-secrets.yml
cron-check-dependency-freshness.yml
cd-cron-publish-weekly-digest.yml
bot-claude.yml
```

Bad:

```
djf-io-ci.yml          # category prefix goes first
ci_djf_io.yml          # underscores; use hyphens
deploy.yml             # missing prefix, ambiguous scope
DjfIoDeploy.yml        # not lowercase
ci.djf-io.yml          # dots
```

The workflow's `name:` field should match the file: same words, title-cased, with the category in
caps. `cd-deploy-web-apps.yml` -> `name: CD Deploy web-apps`.

## Step naming: name each step after the tool it runs

Every step's `name:` should be the CLI tool (or action) that step invokes -- not a paraphrase of
what it does. Reading the workflow log should immediately tell you which tool ran. The exception is
steps that have no single underlying tool (e.g. a shell script doing repo-specific orchestration);
name those after what they produce.

Good:

```yaml
- name: bun install
  run: bun install --frozen-lockfile

- name: biome
  run: bun x biome check .

- name: oxlint
  run: bun x oxlint

- name: vitest
  run: bun x vitest run

- name: playwright
  run: bun x playwright test

- name: wrangler deploy
  uses: cloudflare/wrangler-action@...
```

Bad:

```yaml
- name: Lint # which linter?
  run: bun run lint

- name: Run tests # vitest? playwright? both?
  run: bun run test

- name: Deploy # using what?
  uses: cloudflare/wrangler-action@...
```

If a single package.json script wraps multiple tools (e.g. `"lint": "biome check . && oxlint"`),
split it into separate steps -- one per tool -- so each has its own name and its own log entry. The
example workflow `ci-actions-lint.yml` runs four tools, so it has four steps: `actionlint`,
`ghalint`, `zizmor`, `pinact`.

For `uses:` steps, name the action by its tool (`wrangler deploy`, `actions/checkout` -> `checkout`,
`actions/cache` -> `cache`, `actions/upload-artifact` -> `upload-artifact`).

## Path filters: coarse gates, not a hand-maintained dependency graph

The web apps and their shared packages live in one bun workspace at `workspaces/web-apps/`, and
**Turborepo decides what actually runs**. A task hashes its own package's files plus the hashes of
the packages it depends on, so editing `packages/theme` re-runs its consumers and leaves everything
else on a cache hit. Do not reintroduce per-app `paths:` lists to express that -- the dependency
graph already knows, and a hand-copied list goes stale silently. (It did: extracting one shared
package meant adding `packages/theme/**` to 27 workflow files, none of them checked by anything.)

What a `paths:` filter is still for is keeping a workflow from starting at all when it obviously
cannot be affected -- a docs-only change should not boot a runner. So the workspace workflows carry
**one coarse glob over the whole workspace**, plus the repo-root config that feeds their cache key:

```yaml
on:
  pull_request:
    paths:
      - 'workspaces/web-apps/**'
      - '.config/mise.toml'
      - '.config/mise.lock'
      - '.oxfmtrc.json'
      - '.prettierrc.json'
      - 'bin/**'
      - '.depot/workflows/ci-web-apps.yml'
```

That glob cannot rot the way per-app lists did: a new app or package under the workspace is covered
the day it lands, with no filter edit.

A workflow outside the workspace (`ci-repo.yml`, `ci-docs.yml`) still scopes to the files it
exercises, and `Run` / `Cron` workflows need no filter at all. Deliberately repo-wide gates are the
other exception: `ci-spell.yml` (cspell) and `ci-warden.yml` (AI review) run without a `paths:`
filter and document why in a header comment.

## Fanning out over apps: matrix from the affected set

Per-app preview and deploy workflows are gone. A plan job asks turbo which apps a change affects and
emits a matrix; the fan-out job deploys exactly those:

```yaml
jobs:
  plan:
    outputs:
      apps: ${{ steps.plan.outputs.apps }}
    steps:
      # Full history -- turbo diffs against the merge base.
      - uses: actions/checkout@...
        with: {fetch-depth: 0}
      - id: plan
        run: bun bin/plan-affected-apps.ts preview
  preview:
    needs: plan
    if: needs.plan.outputs.apps != '[]'
    strategy:
      fail-fast: false
      matrix:
        app: ${{ fromJSON(needs.plan.outputs.apps) }}
```

The per-app knowledge turbo cannot infer -- worker name, smoke routes, wrangler config, the suffix
of the app's Sentry/PostHog variables -- lives in one registry in `bin/plan-affected-apps.ts`, with
a test asserting the registry covers every app in the workspace. Adding an app means adding a
registry entry, not a workflow file.

An app whose lifecycle genuinely differs keeps its own workflow and opts out of the matrix
(`preview: 'none'` / `deploy: 'none'`): f311x deploys through alchemy rather than wrangler, and
onvibes.org's preview is a real worker with a teardown. That is the bar -- a genuinely different
shape, not one extra step.

## Adding an app or package to the workspace

Adding `workspaces/web-apps/apps/<name>/` or `workspaces/web-apps/packages/<name>/`:

- [ ] Give it the standard package.json scripts (`typecheck`, `lint`, `format`, `build`, `test`,
      plus `smoke` / `test:e2e` if it deploys) -- turbo discovers work by script name.
- [ ] Declare shared packages as workspace dependencies. That, and nothing else, is what puts the
      app on the graph.
- [ ] If it deploys, add a registry entry in `bin/plan-affected-apps.ts`.
- [ ] Verify with `mise run check` locally, then confirm the app appears in `ci-web-apps.yml`'s run.

No workflow file is created and no `paths:` filter is edited. If you find yourself doing either, the
graph is not expressing something it should.

## Parallelism: matrices and independent jobs

Workflows should finish as fast as the slowest necessary step, no slower.

- **Use `strategy.matrix`** for anything that varies along one axis -- Node versions, OS, app names,
  shard indices. Do not copy-paste near-identical jobs.
- **Split independent work into separate jobs**, not sequential steps in one job -- with one caveat
  inside the workspace: turbo already parallelizes tasks and packages within a single run, and each
  extra job re-pays checkout and install. So `ci-web-apps.yml` groups the cached bulk into one
  `turbo run typecheck lint format build test --continue` (the `--continue` is what preserves "see
  every failure", which separate jobs used to give for free) and splits out only the gates with a
  different character: the uncached smoke boot and e2e.
- **Use `needs:` only when there is a real dependency.** Do not chain jobs to "save runner minutes"
  -- runner minutes are cheap, your iteration time is not.
- **`fail-fast: false`** on matrices when you want to see every failing cell. Default
  `fail-fast: true` is fine for "all green or nothing" gates like deploy preconditions.

Example matrix:

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        app: [djf.io, calendar-visualizer, ravrun]
    runs-on: depot-ubuntu-latest
    steps:
      - uses: actions/checkout@...
      - run: bun run --cwd apps/${{ matrix.app }} test
```

Example parallel jobs:

```yaml
jobs:
  lint:
    runs-on: depot-ubuntu-latest
    steps: [...]
  typecheck:
    runs-on: depot-ubuntu-latest
    steps: [...]
  test:
    runs-on: depot-ubuntu-latest
    steps: [...]
  build:
    needs: [lint, typecheck, test] # only if build actually requires them
    runs-on: depot-ubuntu-latest
    steps: [...]
```

## Checklist for a new workflow

- [ ] File is lowercase kebab-case with the correct category prefix (`ci-`, `cd-`, `run-`, `cron-`,
      `bot-`, or alphabetical combo).
- [ ] `name:` field matches the file.
- [ ] `paths:` filter is a coarse gate (the whole workspace, or the subtree a non-workspace workflow
      exercises) plus the workflow file itself -- never a per-app dependency list.
- [ ] Every step is named after the tool it runs.
- [ ] Independent work runs in parallel jobs; matrices are used where they apply.
- [ ] `needs:` only links jobs with a real dependency.
- [ ] `timeout-minutes` set on every job.
- [ ] `permissions:` set to the minimum the job actually needs.
- [ ] Action versions pinned by SHA (enforced by `pinact` in the Actions hygiene workflow).
