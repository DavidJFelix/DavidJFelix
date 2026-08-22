# merge-queue

Serialize PR merges so `workspaces/web-apps/bun.lock` conflicts resolve themselves. Today every
Renovate batch day produces a pile of PRs that all rewrite the lockfile; the first merge conflicts
the rest, and each one needs a manual rebase-or-click cycle even though the resolution is
mechanical: regenerate the lockfile with bun. The fix is a two-part system built in this repo -- a
lockfile-aware branch updater running in Depot CI (the only place bun and git can run), and a GitHub
App on Cloudflare Workers that owns queue order and drives merges. No external service (Kodiak and
its peers) -- the repo already runs its own Renovate the same way.

## Verified findings (2026-08-22 investigation)

Per [evidence-discipline.md](../../contributing/evidence-discipline.md), what was checked and how:

- **GitHub's native merge queue is unavailable here.** Merge queues exist only on organization-owned
  repos (public on any plan, private on Enterprise Cloud). `DavidJFelix/DavidJFelix` is user-owned,
  so the feature never appears. It also would not help with this problem: a PR with a textual
  conflict cannot enter the queue at all -- the queue solves stale-CI semantics, not conflict
  resolution.
- **bun does not resolve lockfile conflict markers.** Tracked upstream in
  [oven-sh/bun#17717](https://github.com/oven-sh/bun/issues/17717) (open; npm, yarn, and pnpm all do
  this). Verified locally on bun 1.3.11: `bun install --lockfile-only` against a `bun.lock`
  containing conflict markers does not error -- it silently discards the file and re-resolves from
  scratch, floating every `^` range to the latest registry version (a 574-line lockfile rewrite full
  of version bumps nobody reviewed, in the experiment). Never run bare `bun install` on a conflicted
  lockfile.
- **The deterministic recipe works and was verified end to end.** Two branches each `bun add`-ing
  alphabetically adjacent packages reproduce the real conflict (git's ort strategy auto-merges
  far-apart insertions; adjacent lockfile lines conflict). Resolution:

  ```sh
  git merge origin/main                             # conflict only in bun.lock
  git checkout --theirs workspaces/web-apps/bun.lock  # take main's lockfile
  cd workspaces/web-apps && bun install --lockfile-only
  bun install --frozen-lockfile                     # the CI gate, as verification
  ```

  Measured: the regenerated lockfile differs from main's by exactly the PR's own delta (the new
  package plus its hoisting adjustments, 9 insertions / 4 deletions), regeneration takes ~60ms warm,
  repeat runs are byte-identical (equal sha256), and `--frozen-lockfile` passes. Taking **theirs**
  (main's lockfile) is the load-bearing choice: main's resolutions are preserved and only the PR's
  package.json delta re-resolves.

- **Depot CI can be driven externally.** Workflows with `workflow_dispatch` can be triggered via
  `depot ci dispatch` and the
  [Depot CI API](https://depot.dev/docs/ci/how-to-guides/manage-workflow-runs) with an org API
  token. Label-triggered `pull_request` workflows also already work here
  (`bot-update-snapshots-*.yml`), so a GitHub label is a second, proven trigger channel.
- **Pushes must use the App-minted token.** Pushes made with the workflow `GITHUB_TOKEN` do not
  re-trigger CI (documented caveat in `bot-update-snapshots-djf-io.yml`); pushes as a GitHub App do
  (that is why `cron-renovate.yml` mints one). The updater must push with an App token or its merge
  commits sit with stale checks.
- **Renovate already self-heals its own PRs -- slowly.** The hourly `cron-renovate.yml` rebases
  conflicted Renovate branches and regenerates the lockfile. The residual pain is latency (up to an
  hour per PR, serially, on batch Monday), no merge ordering, and human PRs, which Renovate will not
  touch.

## Design

Three phases; each is independently useful and the earlier ones become components of the later.

### Phase 1 -- `bot-update-branch`: the lockfile-aware updater

A Depot workflow (`.depot/workflows/bot-update-branch.yml`) that makes a PR mergeable again:

- **Triggers**: `workflow_dispatch` with a PR number input (for the phase-3 app and manual use),
  plus `push` to `main` that walks open same-repo PRs carrying the opt-in label and dispatches
  itself per PR.
- **Steps** per PR: checkout the PR head, `git merge origin/main`; if the conflict set is exactly
  `workspaces/web-apps/bun.lock`, apply the verified recipe above; validate with
  `bun install --frozen-lockfile`; push the merge commit with an App-minted token
  (`create-github-app-token`, same pattern as `cron-renovate.yml`). Clean merges (no conflict) push
  directly -- the workflow doubles as an update-branch button.
- **Refusals**: any other conflicted path -> comment once on the PR naming the files and skip; fork
  PRs -> skip (token cannot push, same guard as the snapshot bots).
- **Safety**: `--lockfile-only` executes no lifecycle scripts; the `--frozen-lockfile` verification
  install is covered by the workspace `trustedDependencies` policy and the bunfig cooldown. The
  workflow only acts on same-repo branches behind an opt-in label a maintainer set.
- **Determinism caveat, stated honestly**: regeneration re-resolves the PR's own delta against the
  registry at update time. Within-range floats are possible for `^` deps -- the same drift a
  Renovate rebase produces today -- and the bunfig cooldown bounds how fresh a float can be.
  Exact-pinned entries do not move. CI re-runs on the updated head regardless, so nothing merges
  unverified.

Extending the conflict allowlist to the other lockfiles a tool can regenerate (`.config/mise.lock`
via `mise lock`, `Cargo.lock`) is a follow-up once the bun.lock path has run for a while.

### Phase 2 -- auto-merge closes the loop for Renovate

With the updater in place, enable Renovate `automerge` for the grouped update PRs (the decision
[renovate-rollout](../renovate-rollout/plan.md) already tracks as "gated auto-merge"). Batch Monday
then zips itself: PR 1 merges -> push to main fires the updater -> the next labeled PR gets a
resolved merge commit -> CI re-runs -> Renovate's hourly pass merges it, and so on. No new
infrastructure -- ordering is implicit (whichever PR goes green next), which is acceptable for
dependency PRs. Sequencing note: `platformAutomerge` depends on branch protection / required checks,
which the paths-filtered CI makes awkward (untouched apps never report), so start with
Renovate-managed automerge and revisit rulesets separately.

### Phase 3 -- the queue app: a GitHub App on Cloudflare Workers

The piece that adds explicit ordering, human-PR coverage, and one-at-a-time semantics. Lives as a
worker in `workspaces/web-apps/apps/` (working name **zipper**, after the merge pattern;
`workers.dev` is fine, calendar-visualizer precedent), deployed by the existing `cd-deploy-web-apps`
pipeline.

- **GitHub App** (new, separate from the Renovate App so identities and audit trails stay clean):
  webhook URL -> the Worker; permissions contents RW, pull requests RW, checks R, statuses R; events
  `pull_request`, `push`, `check_suite`, `status`.
- **Worker**: verifies `X-Hub-Signature-256` with WebCrypto, then forwards the event to a Durable
  Object keyed by `owner/repo#base-branch`. Octokit runs on Workers (`@octokit/auth-app` JWT signing
  uses WebCrypto); the App private key and webhook secret are Worker secrets.
- **Durable Object = the queue.** Single-threaded execution gives serialization for free;
  SQLite-backed storage holds the ordered PR list and per-PR state:
  `queued -> updating -> testing -> merging -> done | failed`. Only the head of the queue is ever
  updated and tested, so each merge costs exactly one update + CI cycle on the next PR.
- **Enqueue**: the opt-in label (Renovate applies it via `labels` config; humans click it). Label
  removed or PR closed -> dequeue. Failed CI on an updated head -> comment, dequeue, move on.
- **Muscle**: the DO cannot run git or bun -- when the head PR needs updating it dispatches
  `bot-update-branch` through the Depot API (org token as a Worker secret); the label-trigger
  channel is the fallback if the API path disappoints. Merge itself is the GitHub squash-merge API
  with the PR title (conventional commit) as the message.
- **Status surface**: the DO serves a small read-only queue view at the worker URL; also the natural
  place for a later batching mode (optimistic trains), which is explicitly out of the just-enough
  scope.

## Non-goals

- A local git merge driver for `bun.lock`. Git merge drivers cannot ship in-repo (per-clone config),
  and the automation makes the local case rare; the manual recipe above is documented here for when
  it happens.
- Batched/optimistic merge trains, priorities, or multi-repo service ambitions in phase 3's first
  cut. One PR at a time is the just-enough version.
- Migrating CI off Depot or restructuring branch protection; phase 2 deliberately avoids
  required-check rulesets while CI stays paths-filtered.

## Open decisions

- App/queue naming (zipper is a placeholder until the phase-3 PR).
- Whether phase 1 reuses the Renovate App credentials for its token or the phase-3 App from day one
  (leaning: reuse Renovate's for phase 1, cut over when zipper exists).
- Label taxonomy: one label (`queue`) doing double duty as auto-merge opt-in, or separate `queue` /
  `queue:update` labels for enqueue vs. update-only.

## Related

- [renovate-rollout](../renovate-rollout/plan.md) -- owns the gated auto-merge decision phase 2
  executes
- `.depot/workflows/cron-renovate.yml` -- App-token minting pattern; hourly self-healing baseline
- `.depot/workflows/bot-update-snapshots-djf-io.yml` -- label-triggered bot workflow + push caveats
- [oven-sh/bun#17717](https://github.com/oven-sh/bun/issues/17717) -- upstream feature that would
  simplify phase 1 to a single `bun install`
