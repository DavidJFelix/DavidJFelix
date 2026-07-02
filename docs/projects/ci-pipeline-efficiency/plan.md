# ci-pipeline-efficiency

Two CI pain points David flagged: too many workflows run on a given change, and dependency/browser
installs are slow. Make CI trigger only the workflows a change can actually affect, and cache the
steps that currently start cold. Grounded in a full survey of `.depot/workflows/`.

## Task 1 — Trigger filtering (only the correct actions run)

David's steer: the lever here is **better filtering**, not run-deduplication. (Concurrency /
cancel-in-progress was considered and set aside — it trims wasted compute on rapid pushes but does
not stop the *wrong* workflows from running.) The principle: a workflow triggers only on changes
that can change its result.

The fan-out today: all 10 per-app `ci-*.yml` workflows list the same shared root files in their
`paths:` filter — `.config/cspell.json`, `.config/mise.toml`, `biome.jsonc`, `.oxlintrc.json`,
`.prettierrc.json` — so a one-line root-config change runs ~60 jobs across every app.

- **Remove the spurious paths** `.config/cspell.json` and `.prettierrc.json` from every per-app
  filter. Apps run neither cspell (it's the repo-wide `ci-spell.yml` gate) nor Prettier (Markdown
  only, repo-level). Clear win, no safety loss. (This also shrinks the `lint-format-loose-ends`
  cspell→jsonc rename, which otherwise has to edit all these filters.)
- **Path-filter `ci-spell.yml`.** It currently has no `paths:` and runs on *every* push/PR.
  Restrict it to spell-checkable file types + `.config/cspell.json*` + its own workflow.
- **Drop the redundant `cd-deploy-*.yml` self-references** from `ci-f311x.yml` and
  `ci-forzamonica-com.yml` path filters (a deploy-workflow edit shouldn't trigger app CI).
- **Decide the shared toolchain/lint configs.** `biome.jsonc`, `.oxlintrc.json`, and
  `.config/mise.toml` legitimately affect every app, which is why they fan out — but that fan-out is
  most of the "too many actions." Options to choose at execution: (a) keep the fan-out (safe,
  noisy); (b) drop them from per-app filters and let a single repo-wide lint/format job (extend
  `ci-repo.yml`) validate shared-config changes once; (c) keep only `mise.toml` (toolchain/version
  bumps) fanning out and move Biome/Oxlint validation to the repo-wide job. Recommendation: (c) —
  toolchain changes genuinely need per-app re-test, lint-rule changes can be caught by one repo-wide
  run. **Confirm with David before flipping.**

## Task 2 — Caching (stop starting cold)

- **Cache the pnpm store across CI.** mise tools are already cached (the `setup-mise` composite,
  keyed on `mise.toml`/`mise.lock`), but every `pnpm install --frozen-lockfile` re-downloads from
  cold — the biggest install-speed win. Add `actions/cache` on `pnpm store path`, keyed on
  `**/pnpm-lock.yaml` (matching the repo's existing version-keyed cache convention).
- **Fix the blocking web-session Playwright install.** `.claude/hooks/session-start.ts` *awaits*
  `playwright install --with-deps chromium` (~300 MB) on every cold web session, even though most
  sessions never run e2e — this is the "waiting FOREVER" pain. Options: make it non-blocking (kick
  it off without `await`) or lazy (install on first e2e run); cache-guard on `~/.cache/ms-playwright`
  if the web env persists it; drop `--with-deps` if the base image already carries the OS libs.
- **CI Playwright is already cached** — `ci-djf-io.yml` and the `preview-wrangler` composite key the
  browser cache on the resolved Playwright version, and only djf.io runs Playwright in CI, so this
  is likely already optimal. Confirm, don't duplicate.
- **Optional, lower priority:** build-artifact caching (Astro `.astro/`, Vite, `.tsbuildinfo`).

## Considered and rejected: Depot snapshot images (2026-07-02)

Depot CI's snapshot enhancements (2026-06-26: create and reuse a sandbox image in one workflow via
a `snapshot:` job key, jobs booting from it with `runs-on: {image, size}`) looked like the answer
to Task 2, so a full conversion was built across all per-app workflows -- then measured against
real check-run timings and scrapped. Baseline from PRs #304 / #307 / #315: per-app CI jobs
(checkout + mise + `pnpm install` + tool) complete in 19-29 s, the djf.io Playwright job in ~49 s,
full wrangler previews in 37-102 s, and a 22-job `bin/**` fan-out ran with no contention penalty.
Depot's caching already holds setup to roughly 10-15 s per job -- which also softens Task 2's
premise that the pnpm store is the biggest win. Booting from per-app images would save those
seconds while adding: a `needs: snapshot` hop to every job, full-graph serialization behind a
2-4 minute image rebuild whenever the tag expires or is missing, a zizmor parse gap (it cannot
read `runs-on: {image, size}` and skips such files), and an org-shared image writable from fork
PRs. One anomaly (PR #315: every job a uniform ~53 s, even cspell) was queue/sync overhead, which
images would not fix. Revisit only if setup grows to minutes -- sharded e2e reusing one setup,
service-container pulls, or much heavier installs.

Also checked while in there: every job already runs on the 2-vCPU / 1x-billing floor
(`depot-ubuntu-latest` = `2x8`), so there is no smaller sandbox to downsize low-parallelism jobs
onto.

## Survey corrections

- There is **no push+PR double-run**: `push` is gated to `branches: [main]`, so PR branches fire
  once (on `pull_request`) and main fires once (on `push`).
- Keep, don't blanket-remove, root-config paths — see Task 1's decision; `mise.toml` especially
  guards real toolchain changes.

## Related

- `lint-format-loose-ends` — its cspell→jsonc rename sequences after Task 1's filter cleanup
- Survey basis: `.depot/workflows/ci-*.yml`, `cd-*.yml`, `.depot/actions/setup-mise/`,
  `.depot/actions/preview-wrangler/`, `.claude/hooks/session-start.ts`
