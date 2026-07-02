# renovate-rollout

Residual of the closed `dependency-freshness` project (see the 2026-06-18 changelog). The 2026-06-11
decision handed dependency ownership to Renovate; this finishes the rollout and retires the bespoke
freshness skill.

## Scope

### 1. Extend Renovate repo-wide

- Today only `apps/djf.io/.github/renovate.json` is configured (extends `config:best-practices`).
  Extend Renovate to the whole repo across all managers — **npm + mise + Cargo** (native managers
  exist for all three) — and enable **`lockFileMaintenance`** so transitive drift gets lockfile-only
  refresh PRs (`config:best-practices` does not include it).
- Confirm **Dependabot is off** anywhere Renovate is on, to avoid double-PR churn.

### 2. Pin the `latest`-tagged deps

- `@typescript/native-preview` (tsgo) is pinned to `latest` in davidjfelix.com, djf.io, f311x, and
  ravrun — unreproducible and invisible to Renovate. Pin real versions once Renovate sees them.

### 3. Revisit gated auto-merge

- Previews shipped (2026-06-17), so the auto-merge bar the parent project set — real test suite +
  preview verification, gated per-PR via Renovate `automerge` rather than branch-protection required
  checks (paths-filtered CIs never report on untouched apps) — is now reachable. Decide which apps
  qualify.

### 4. Retire the freshness skill (sequence LAST, after coverage is confirmed)

Once Renovate demonstrably owns every ecosystem, remove the bespoke tooling so there's one system,
not two:

- Delete `.claude/skills/dependency-freshness/`
- Delete `.depot/workflows/cron-dependency-freshness.yml`
- Delete `.claude/commands/dependency-freshness.md`
- Remove the skill/command mentions from `CLAUDE.md` and `AGENTS.md`

## Related

- Closed parent: `docs/changelog/2026-06.md` (2026-06-18)
- `apps/djf.io/.github/renovate.json` — the config to generalize
