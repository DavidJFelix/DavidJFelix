# GitHub Actions style guide

Conventions for workflows in `.github/workflows/`.

## Workflow categories

Every workflow falls into exactly one of these four buckets. The bucket determines the file prefix and how the workflow is triggered.

| Category | Prefix | Triggers |
| --- | --- | --- |
| **CI** -- Continuous Integration | `ci_` | `push` to `main`, `pull_request` |
| **CD** -- Continuous Delivery | `cd_` | `push` to `main` (after CI), release tags |
| **Run** -- Manual operations | `run_` | `workflow_dispatch` only |
| **Cron** -- Scheduled jobs | `cron_` | `schedule` only |

If a workflow legitimately spans two categories, combine the prefixes in alphabetical order, space-separated in the display name and underscore-separated in the file name:

- A scheduled deployment is `CD CRON` (display name) / `cd_cron_*.yml` (file).
- A manually-triggered CI rerun is `CI RUN` / `ci_run_*.yml`.

Do not invent new categories. If a workflow does not fit, it is probably two workflows.

## File naming

- All workflow files are lowercase.
- Use underscores (`_`) as the separator -- not hyphens, not dots.
- The file name starts with the category prefix, then describes what the workflow does.

Good:

```
ci_lint.yml
ci_djf_io.yml
cd_deploy_djf_io.yml
cd_deploy_calendar_visualizer.yml
run_rotate_secrets.yml
cron_check_dependency_freshness.yml
cd_cron_publish_weekly_digest.yml
```

Bad:

```
djf-io-ci.yml          # missing prefix, uses hyphens
deploy.yml             # missing prefix, ambiguous scope
DjfIoDeploy.yml        # not lowercase
ci.djf-io.yml          # dots, hyphens
```

The workflow's `name:` field should match the file: same words, title-cased, with the category in caps. `cd_deploy_djf_io.yml` -> `name: CD Deploy djf.io`.

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

- [ ] File is lowercase with the correct category prefix (`ci_`, `cd_`, `run_`, `cron_`, or alphabetical combo).
- [ ] `name:` field matches the file.
- [ ] `paths:` filter covers the subtree, relevant shared config, and the workflow file itself (CI/CD only).
- [ ] Independent work runs in parallel jobs; matrices are used where they apply.
- [ ] `needs:` only links jobs with a real dependency.
- [ ] `timeout-minutes` set on every job.
- [ ] `permissions:` set to the minimum the job actually needs.
- [ ] Action versions pinned by SHA (enforced by `pinact` in the Actions hygiene workflow).
