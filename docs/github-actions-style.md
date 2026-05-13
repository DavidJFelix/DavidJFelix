# GitHub Actions style guide

Conventions for workflows in `.github/workflows/`.

## Workflow categories

Every workflow falls into exactly one of these buckets. The bucket determines the file prefix and how the workflow is triggered.

| Category | Prefix | Triggers |
| --- | --- | --- |
| **CI** -- Continuous Integration | `ci_` | `push` to `main`, `pull_request` |
| **CD** -- Continuous Delivery | `cd_` | `push` to `main` (after CI), release tags |
| **Run** -- Manual operations | `run_` | `workflow_dispatch` only |
| **Cron** -- Scheduled jobs | `cron_` | `schedule` only |
| **Bot** -- Event-driven third-party integrations | `bot_` | `issue_comment`, `pull_request_review_comment`, `issues`, etc. -- typically responding to a mention or webhook |

If a workflow legitimately spans two categories, combine the prefixes in alphabetical order, space-separated in the display name and underscore-separated in the file name:

- A scheduled deployment is `CD CRON` (display name) / `cd_cron_*.yml` (file).
- A manually-triggered CI rerun is `CI RUN` / `ci_run_*.yml`.

Do not invent new categories beyond these. If a workflow does not fit, it is probably two workflows.

`Bot` is reserved for integrations whose trigger is a human (or other bot) reacting to repo activity -- comment mentions, label additions, webhook callbacks. A `Bot` workflow does not gate merges and is not on the deploy path. A workflow that automatically runs a quality check on every PR is `CI`, not `Bot`, even if a bot posts the result.

## File naming

- All workflow files are lowercase.
- Use underscores (`_`) as the separator -- not hyphens, not dots.
- The file name starts with the category prefix, then describes what the workflow does.

Good:

```
ci_actions_lint.yml
ci_djf_io.yml
cd_deploy_djf_io.yml
cd_deploy_calendar_visualizer.yml
run_rotate_secrets.yml
cron_check_dependency_freshness.yml
cd_cron_publish_weekly_digest.yml
bot_claude.yml
```

Bad:

```
djf-io-ci.yml          # missing prefix, uses hyphens
deploy.yml             # missing prefix, ambiguous scope
DjfIoDeploy.yml        # not lowercase
ci.djf-io.yml          # dots, hyphens
```

The workflow's `name:` field should match the file: same words, title-cased, with the category in caps. `cd_deploy_djf_io.yml` -> `name: CD Deploy djf.io`.

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

If a single `pnpm` script wraps multiple tools (e.g. `"lint": "biome check . && oxlint"`), split it into separate steps -- one per tool -- so each has its own name and its own log entry. The example workflow `ci_actions_lint.yml` runs four tools, so it has four steps: `actionlint`, `ghalint`, `zizmor`, `pinact`.

For `uses:` steps, name the action by its tool (`wrangler deploy`, `actions/checkout` -> `checkout`, `actions/cache` -> `cache`, `actions/upload-artifact` -> `upload-artifact`).

## Path filters: only run when the relevant subtree changes

Every CI and CD workflow MUST include `paths:` filters on its `push` and `pull_request` triggers. Workflows pay for themselves only when they cover the code that changed.

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
      - '.github/workflows/ci_djf_io.yml'
  pull_request:
    paths:
      - 'apps/djf.io/**'
      - '.config/cspell.json'
      - '.config/mise.toml'
      - 'biome.jsonc'
      - '.github/workflows/ci_djf_io.yml'
```

`Run` and `Cron` workflows do not need path filters -- they are dispatched explicitly or on a schedule.

## Adding code to a subtree

When you introduce a new app, package, or top-level subtree, you are responsible for making sure the right workflows fire on it. Before merging:

- [ ] Identify which existing workflows should cover the new subtree (lint, typecheck, deploy, etc.).
- [ ] Add the new path(s) to each of those workflows' `paths:` filters.
- [ ] If no existing workflow covers it, add new `ci_<subtree>.yml` (and `cd_deploy_<subtree>.yml` if it deploys).
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
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@...
      - run: pnpm --filter ${{ matrix.app }} test
```

Example parallel jobs:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  typecheck:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
  build:
    needs: [lint, typecheck, test]  # only if build actually requires them
    runs-on: ubuntu-latest
    steps: [...]
```

## Checklist for a new workflow

- [ ] File is lowercase with the correct category prefix (`ci_`, `cd_`, `run_`, `cron_`, `bot_`, or alphabetical combo).
- [ ] `name:` field matches the file.
- [ ] `paths:` filter covers the subtree, relevant shared config, and the workflow file itself (CI/CD only).
- [ ] Every step is named after the tool it runs.
- [ ] Independent work runs in parallel jobs; matrices are used where they apply.
- [ ] `needs:` only links jobs with a real dependency.
- [ ] `timeout-minutes` set on every job.
- [ ] `permissions:` set to the minimum the job actually needs.
- [ ] Action versions pinned by SHA (enforced by `pinact` in the Actions hygiene workflow).
