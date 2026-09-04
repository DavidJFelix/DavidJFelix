# Depot CI triage

<!-- cSpell:ignore 5rkz04f91p -->

How to see what actually happened when a Depot CI check fails. The workflows in `.depot/workflows/`
run on [Depot CI](https://depot.dev), not GitHub Actions;
[github-actions-style.md](../contributing/github-actions-style.md) covers authoring them. This doc
covers reading their results.

## Why GitHub shows you nothing

Depot posts each job to GitHub as a bare check run: a name, a conclusion, and a `details_url` into
the Depot dashboard. The check run's `output` fields are empty even on failure, and there is no
GitHub Actions run behind it, so GitHub-side log APIs (the GitHub MCP `get_job_logs`,
`gh run view --log`) have nothing to return. Logs, diagnostics, step summaries, and artifacts exist
only behind Depot's API, and the `depot` CLI is the way in. Never diagnose a failure from the
check-run name alone -- get the logs.

## The depot CLI

The CLI is mise-managed (`.config/mise.toml`). If `depot` is not on PATH, run it as
`mise x depot -- depot ...`.

Authentication: the CLI reads `DEPOT_TOKEN` (or `--token`, or the credential stored by an
interactive `depot login`). Depot CI commands require a **user or organization token** -- project
tokens cannot read CI. The Depot org ID is `5rkz04f91p`; add `--org 5rkz04f91p` if a user token
belongs to multiple orgs. Without a token, every command fails with
`unauthenticated: Missing authorization header`. If you see that, the session has no `DEPOT_TOKEN`
-- report the failing check by name and say you cannot read its output, rather than guessing at the
cause.

## Finding the run

Depot's hierarchy: a **run** (one trigger event) contains **workflows** (one per workflow file),
which contain **jobs**, which have **attempts** (retries add attempts). Two ways to get IDs:

- **From a GitHub check run** (what a PR's checks list shows): its `details_url` has the shape
  `https://depot.dev/orgs/<org-id>/workflows/<workflow-id>?job=<job-id>`. The `job` query parameter
  is a job ID the CLI accepts directly.
- **From the CLI**:

  ```sh
  depot ci run list --repo DavidJFelix/DavidJFelix --status failed --pr 475
  depot ci run list --repo DavidJFelix/DavidJFelix --sha abc123 --output json
  ```

## Reading a failure

In order of signal per token:

1. `depot ci diagnose --job <job-id>` -- bounded stored failure context; the fastest first look.
   Also takes `--run`, `--workflow`, or `--attempt`.
2. `depot ci logs <job-id>` -- full job logs, resolved to the latest attempt. From a run ID,
   disambiguate with `--job <job-key>` and `--workflow <file.yml>`. Use `--output-file logs.txt` for
   large logs and `--follow` to stream a still-running job.
3. `depot ci summary <job-id>` -- the authored step-summary markdown, when the workflow wrote one.
4. `depot ci artifacts list <run-id>`, then
   `depot ci artifacts download <artifact-id> --output-file <file>` -- Playwright reports,
   screenshots, and anything else the run uploaded.
5. `depot ci status <run-id>` -- the workflow/job/attempt tree, when you need the shape of the whole
   run.

Jobs that upload a JUnit report (so far only `ci-spell`, via `depot/test-report-action`) also show
their failures parsed out in the Depot dashboard's test results view, one test case per finding.
That view is a summary; the job log is still the full picture.

## Acting on it

- `depot ci retry <run-id> --failed` retries every failed job in the workflow (`--workflow` if the
  run has several); `--job <job-id>` retries one. Retry to confirm a suspected flake, never to dodge
  a real failure.
- `depot ci rerun <run-id>` re-runs a completed workflow from scratch.
- `depot ci run --workflow .depot/workflows/<file>.yml` runs a workflow against your local tree
  without pushing -- changes not yet pushed upload as a patch. `--job <name>` scopes it, and
  `--follow` streams the logs back.
