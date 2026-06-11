# Dependency Freshness

## Goal

Keep every package and tool in the repo current. Nothing should fall significantly behind.

## Scope

- mise is the source of truth for tool versions
- Audit current package and tool versions across the monorepo
- Author a reusable skill for evaluating, applying, and PRing dependency updates
- Schedule the skill on cron and expose it as a slash command in Claude Code
- Establish a cadence for sweeps and a policy for handling breaking changes

## Implementation

### Phase 1: Audit

- Inventory current package versions across all apps vs. latest
- Inventory mise-managed tool versions vs. latest
- Identify worst offenders to inform the first sweep

### Phase 2: Author the freshness skill

A Claude skill that:

1. **Discovers** outdated packages and tools across the monorepo, grouped by ecosystem (npm, mise, etc.)
2. **Evaluates** each update before applying:
   - Pull the upstream changelog / release notes
   - Note the semver delta (patch / minor / major)
   - Flag packages known not to follow semver
3. **Applies** updates in batches:
   - **One PR per ecosystem** for patch + minor bumps (e.g. one PR for all npm minors, one for all mise minors)
   - **Major version bumps split out** into their own PRs — each gets real review
   - **Known-incompatible bumps** the skill detects (test failures, broken compat in packages that don't follow semver) get split out into their own task PRs; the skill still does them, but isolated
4. **Verifies** by running the test suite (and any project-specific check command) before opening each PR
5. **Documents** each PR body with:
   - The packages and version deltas included
   - Changelog excerpts for each
   - Test results
   - Any flagged risks (majors, non-semver packages, test failures)

### Phase 3: Triggers

- **Cron**: weekly scheduled run via GitHub Actions, Monday 06:00 UTC (one schedule covers all ecosystems)
- **Slash command**: `/dependency-freshness` for local on-demand runs in Claude Code
- Both paths use the same skill

### Phase 4: Policy

- Cadence: **weekly** across all ecosystems (npm, mise, Cargo)
- Escalation: a single `deps:needs-attention` label on any PR carrying a major or
  known-incompatible bump — no companion issues. Anything the skill couldn't apply
  goes in a `## Skipped` section of the batch PR body. One surface to review.
- Genuine human-intervention cases (a credential, a deprecated package needing a
  replacement decision) still follow the Human Intervention Task convention in
  `CLAUDE.md` — but that's the exception, not the routine path.
- Document the policy alongside the skill

### Phase 5: Full automation — gated auto-merge

The current state produces PRs but still relies on a human to merge them, so the
loop isn't actually unattended. Close that gap.

- **Per-package verification on every update PR.** Each package touched by an
  update PR (Renovate batches *and* skill batches) must run the full check set
  for the affected subtree(s): **typecheck, lint, format, test, and build** —
  the same five-check set Phase 3b has each app declare. A package is only
  eligible for automation once it declares all five in a discoverable form (mise
  task preferred). Packages missing a check are surfaced, not silently skipped.
- **Green gates the merge.** When all required checks pass on a patch/minor batch
  PR, enable Renovate `automerge` (and matching auto-merge for skill-produced
  PRs) so it lands without human action.
- **Red blocks automatically.** Any failing check holds the PR open and applies
  `deps:needs-attention` for human review — never auto-merge on red.
- **Majors and known-incompatible bumps never auto-merge**, regardless of check
  status — they stay human-reviewed per Phase 4.
- **Coverage gate:** auto-merge only turns on for a package once its subtree
  check set exists. This depends on the per-project subtree checks from the
  [Linter & Formatter Standardization](../linter-formatter-standardization/plan.md)
  project (Phase 3b) — that work defines how each app declares its checks and how
  CI runs them on subtree changes. Sequence behind it.

## Open: full automation (auto-merge + comprehensive checks)

Tracked as Phase 5 above. Two gaps the user flagged 2026-05-29:

1. It doesn't feel fully automated — PRs still need a human merge. Need gated
   auto-merge (Renovate `automerge` + auto-merge on skill PRs) on green.
2. Checks aren't comprehensive enough to safely gate. Every package in an update
   PR needs typecheck + lint + format + test + build run so the result can block
   (red) or approve (green) the change automatically.

Hard dependency on Linter/Formatter Phase 3b (per-project subtree checks) for the
"each app declares its checks" mechanism. Don't enable auto-merge ahead of that.

**Update 2026-06-09/10**: Phase 3b landed — every app declares its checks as
mise tasks (`apps/<name>/mise.toml`) and has per-app CI running them. All five
apps now declare the full five-check contract; in calendar-visualizer,
davidjfelix.com, and ravrun the test suite is Vitest wired with
`passWithNoTests` (trivially green until real tests land), so weigh that when
deciding whether they qualify for auto-merge or only djf.io and f311x do.

**Update 2026-06-11**: Priority lowered and the bar raised.

- *Priority*: PR volume is currently manageable, so unattended merging is
  desirable but not urgent. Phase 5 is parked behind the
  [preview-deployments](../preview-deployments/plan.md) project.
- *The bar*: green typecheck/lint/format/build plus a trivially-green
  (`passWithNoTests`) suite is not enough. Auto-merge for a web app requires a
  real test suite **and** preview verification — a per-PR preview deployment
  with smoke and screenshot tests. f311x shipping broken on green CI
  (2026-06-11) is the motivating example.
- *Mechanism*: GitHub branch-protection required checks are out — the per-app
  CI workflows are paths-filtered, so untouched apps never report a status and
  required checks would block forever. Gate per-PR via Renovate `automerge` /
  GitHub auto-merge on the checks that actually ran.

## Open: transitive dependency drift

Current gap: Renovate is pinning newer versions of transitive deps in lockfiles, and our sweep doesn't see them. The skill only inspects manifests.

Don't build a new tool for this. The canonical answer is **Renovate's `lockFileMaintenance`** — enabling it on a schedule produces lockfile-only PRs that refresh transitives within manifest constraints. `config:best-practices` (what `apps/djf.io/.github/renovate.json` extends today) does **not** include it.

**Decision 2026-06-11 — Renovate owns everything.** David's call: Renovate
handles all ecosystems — npm, mise, and Cargo (native Renovate managers exist
for all three) — plus `lockFileMaintenance` for transitives. The skill no
longer owns manifest bumps for any ecosystem. What remains for the skill
(changelog summarization on Renovate PRs? cross-ecosystem batching? nothing?)
is an open question; it may retire. This also shrinks the
[LLM Automation Migration](../llm-automation-migration/plan.md) scope: if
Renovate replaces the freshness cron, only the PR-review bot remains to
migrate.

Remaining work items under that decision:

- Extend Renovate config from djf.io to the whole repo (npm + mise + Cargo
  managers), with `lockFileMaintenance` enabled
- Confirm Dependabot is off where Renovate is on (avoid double-PR churn)
- Decide the skill's residual role (or retire it) and update the cron workflow
  accordingly

## Working Notes

- Collaborative project — proposals and tradeoffs go to user before execution.
- This is the ongoing-maintenance layer on top of the (now-completed) mise tool consolidation work.
- Found 2026-06-11: `@typescript/native-preview` (tsgo) is pinned to `latest`
  in davidjfelix.com, djf.io, f311x, and ravrun — unreproducible and invisible
  to Renovate. Pin real versions when Renovate coverage is extended.
