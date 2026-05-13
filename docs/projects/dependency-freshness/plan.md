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
- Define an escalation path when a major bump or known-incompatible update lands in a PR
- Document the policy alongside the skill

## Working Notes

- Collaborative project — proposals and tradeoffs go to user before execution.
- This is the ongoing-maintenance layer on top of the (now-completed) mise tool consolidation work.
