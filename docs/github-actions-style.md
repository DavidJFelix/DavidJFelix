# GitHub Actions style guide

Conventions for the repo's workflows. They are written in GitHub Actions syntax but run on
[Depot CI](https://depot.dev) from `.depot/workflows/` (on `depot-ubuntu-latest` runners), so the
path and runner-label examples below reflect that.

## Workflow categories

Every workflow falls into exactly one of these buckets. The bucket determines the file prefix and how the workflow is triggered.

| Category | Prefix | Triggers |
| --- | --- | --- |
| **CI** -- Continuous Integration | `ci-` | `push` to `main`, `pull_request` |
| **CD** -- Continuous Delivery | `cd-` | `push` to `main` (after CI), release tags |
| **Run** -- Manual operations | `run-` | `workflow_dispatch` only |
| **Cron** -- Scheduled jobs | `cron-` | `schedule` only |
| **Bot** -- Event-driven third-party integrations | `bot-` | `issue_comment`, `pull_request_review_comment`, `issues`, etc. -- typically responding to a mention or webhook |

If a workflow legitimately spans two categories, combine the prefixes in alphabetical order, space-separated in the display name and hyphen-separated in the file name:

- A scheduled deployment is `CD CRON` (display name) / `cd-cron-*.yml` (file).
- A manually-triggered CI rerun is `CI RUN` / `ci-run-*.yml`.

Do not invent new categories beyond these. If a workflow does not fit, it is probably two workflows.

`Bot` is reserved for integrations whose trigger is a human (or other bot) reacting to repo activity -- comment mentions, label additions, webhook callbacks. A `Bot` workflow does not gate merges and is not on the deploy path. A workflow that automatically runs a quality check on every PR is `CI`, not `Bot`, even if a bot posts the result.

## File naming

- All workflow files are lowercase.
- Use hyphens (`-`) as the separator -- kebab-case, per the repo-wide file naming rule in CLAUDE.md. Not underscores, not dots.
- The file name starts with the category prefix, then describes what the workflow does.

Good:

```
ci-actions-lint.yml
ci-djf-io.yml
cd-deploy-djf-io.yml
cd-deploy-calendar-visualizer.yml
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

The workflow's `name:` field should match the file: same words, title-cased, with the category in caps. `cd-deploy-djf-io.yml` -> `name: CD Deploy djf.io`.

## Step naming: name each step after the tool it runs

Every step's `name:` should be the CLI tool (or action) that step invokes -- not a paraphrase of what it does. Reading the workflow log should immediately tell you which tool ran. The exception is steps that have no single underlying tool (e.g. a shell script doing repo-specific orchestration); name those after what they produce.

Good:

```yaml
- name: pnpm install
  run: pnpm install --frozen-lockfile

- name: biome
  run: pnpm exec biome check .

- name: oxlint
  run: pnpm exec oxlint

- name: vitest
  run: pnpm exec vitest run

- name: playwright
  run: pnpm exec playwright test

- name: wrangler deploy
  uses: cloudflare/wrangler-action@...
```

Bad:

```yaml
- name: Lint                  # which linter?
  run: pnpm lint

- name: Run tests             # vitest? playwright? both?
  run: pnpm test

- name: Deploy                # using what?
  uses: cloudflare/wrangler-action@...
```

If a single `pnpm` script wraps multiple tools (e.g. `"lint": "biome check . && oxlint"`), split it into separate steps -- one per tool -- so each has its own name and its own log entry. The example workflow `ci-actions-lint.yml` runs four tools, so it has four steps: `actionlint`, `ghalint`, `zizmor`, `pinact`.

For `uses:` steps, name the action by its tool (`wrangler deploy`, `actions/checkout` -> `checkout`, `actions/cache` -> `cache`, `actions/upload-artifact` -> `upload-artifact`).

## Path filters: only run when the relevant subtree changes

Every CI and CD workflow that targets a specific subtree MUST include `paths:` filters on its `push` and `pull_request` triggers. Workflows pay for themselves only when they cover the code that changed.

The path filter must include:

1. The app or package subtree the workflow exercises (e.g. `apps/djf.io/**`).
2. Any shared config the workflow depends on (`biome.jsonc`, `.config/cspell.json`, `.config/mise.toml`, root `package.json`, lockfile, etc.).
3. The workflow file itself, so changes to the workflow re-trigger it.

Example:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'apps/djf.io/**'
      - '.config/cspell.json'
      - '.config/mise.toml'
      - 'biome.jsonc'
      - '.depot/workflows/ci-djf-io.yml'
  pull_request:
    paths:
      - 'apps/djf.io/**'
      - '.config/cspell.json'
      - '.config/mise.toml'
      - 'biome.jsonc'
      - '.depot/workflows/ci-djf-io.yml'
```

`Run` and `Cron` workflows do not need path filters -- they are dispatched explicitly or on a schedule.

Deliberately repo-wide gates are the other exception: a check that must see every PR regardless of what changed -- `ci-spell.yml` (cspell) and `ci-warden.yml` (AI review) -- runs without a `paths:` filter and documents why in a header comment. This is a narrow carve-out, not a license to skip filters: a workflow that exercises one subtree still scopes to it.

## Adding code to a subtree

When you introduce a new app, package, or top-level subtree, you are responsible for making sure the right workflows fire on it. Before merging:

- [ ] Identify which existing workflows should cover the new subtree (lint, typecheck, deploy, etc.).
- [ ] Add the new path(s) to each of those workflows' `paths:` filters.
- [ ] If no existing workflow covers it, add new `ci-<subtree>.yml` (and `cd-deploy-<subtree>.yml` if it deploys).
- [ ] Verify by pushing a no-op change inside the subtree and confirming the expected workflows ran. A workflow that does not trigger is worse than no workflow at all -- it gives false confidence.

The reverse is also true: when you delete a subtree, remove its path filters and any now-orphaned workflows.

## Parallelism: matrices and independent jobs

Workflows should finish as fast as the slowest necessary step, no slower.

- **Use `strategy.matrix`** for anything that varies along one axis -- Node versions, OS, app names, shard indices. Do not copy-paste near-identical jobs.
- **Split independent work into separate jobs**, not sequential steps in one job. Lint, typecheck, unit tests, and build have no runtime dependency on each other; they should run in parallel and fail independently.
- **Use `needs:` only when there is a real dependency.** Do not chain jobs to "save runner minutes" -- runner minutes are cheap, your iteration time is not.
- **`fail-fast: false`** on matrices when you want to see every failing cell. Default `fail-fast: true` is fine for "all green or nothing" gates like deploy preconditions.

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
      - run: pnpm --filter ${{ matrix.app }} test
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
    needs: [lint, typecheck, test]  # only if build actually requires them
    runs-on: depot-ubuntu-latest
    steps: [...]
```

## Checklist for a new workflow

- [ ] File is lowercase kebab-case with the correct category prefix (`ci-`, `cd-`, `run-`, `cron-`, `bot-`, or alphabetical combo).
- [ ] `name:` field matches the file.
- [ ] `paths:` filter covers the subtree, relevant shared config, and the workflow file itself (CI/CD only).
- [ ] Every step is named after the tool it runs.
- [ ] Independent work runs in parallel jobs; matrices are used where they apply.
- [ ] `needs:` only links jobs with a real dependency.
- [ ] `timeout-minutes` set on every job.
- [ ] `permissions:` set to the minimum the job actually needs.
- [ ] Action versions pinned by SHA (enforced by `pinact` in the Actions hygiene workflow).
