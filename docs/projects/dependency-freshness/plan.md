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
  for the affected subtree(s): **typecheck, lint, format, and tests**. A package
  is only eligible for automation once it declares all four in a discoverable
  form (mise task preferred). Packages missing a check are surfaced, not silently
  skipped.
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
   PR needs typecheck + lint + format + tests run so the result can block (red)
   or approve (green) the change automatically.

Hard dependency on Linter/Formatter Phase 3b (per-project subtree checks) for the
"each app declares its checks" mechanism. Don't enable auto-merge ahead of that.

## Open: transitive dependency drift

Current gap: Renovate is pinning newer versions of transitive deps in lockfiles, and our sweep doesn't see them. The skill only inspects manifests.

Don't build a new tool for this. The canonical answer is **Renovate's `lockFileMaintenance`** — enabling it on a schedule produces lockfile-only PRs that refresh transitives within manifest constraints. `config:best-practices` (what `apps/djf.io/.github/renovate.json` extends today) does **not** include it.

Decision items:

- Roll `lockFileMaintenance` onto every project with a Renovate config (currently only djf.io has one — extend coverage first)
- Define the division of labor: Renovate owns transitive/lockfile freshness, our skill owns manifest bumps + non-npm ecosystems (mise, Cargo) + cross-ecosystem batching
- Confirm Dependabot is off where Renovate is on (avoid double-PR churn)

## Working Notes

- Collaborative project — proposals and tradeoffs go to user before execution.
- This is the ongoing-maintenance layer on top of the (now-completed) mise tool consolidation work.
