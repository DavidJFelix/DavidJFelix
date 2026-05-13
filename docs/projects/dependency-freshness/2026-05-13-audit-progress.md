# 2026-05-13 Progress (afternoon)

## Summary

Ran the Phase 1 audit and sketched the Phase 2 skill scaffolding.

## Phase 1 audit findings

### Ecosystem reality check

The repo is **not** JS-only — it's polyglot already:

- **npm**: 4 apps in `apps/` + 2 exercises in `Joy-of-React/`. No root pnpm workspace; each app installs independently.
- **mise**: 9 tools in `.config/mise.toml` (node, pnpm, biome, oxlint, prettier, actionlint, ghalint, zizmor, pinact). `mise.lock` is the resolved-version source of truth.
- **Cargo**: workspace at root, members under `Advent-of-Code/2022/rust/*`. Additional standalone crates under `Exercism/rust/*` (not in the workspace).

This was missed in the linter-standardization plan ("aspirational — no Rust in repo today"). Updating that plan separately.

### Worst offenders (today, latest version in parens)

**JS — major bumps available:**

- `typescript` — every app on 5.x (5.3.3 → 5.9.3). Latest is `6.0.3`. Every app needs a major.
- `cspell` — apps on `^9.x`. Latest is `10.0.0`. Major.
- `vitest` — djf.io on `^3.2.4`. Latest is `4.1.6`. Major.
- `@astrojs/react` — calendar-visualizer on `^4.4.0`. Latest is `5.0.5`. Major.
- **ravrun** is the most stale app overall:
  - React 18.3.1 → 19.2.6 (major)
  - Vite 6.0.3 → 8.0.12 (two majors)
  - @vitejs/plugin-react 4.3.2 → 6.0.1 (two majors)
  - @types/react 18.x → 19.2.14 (major)
  - TypeScript 5.3.3 → 6.0.3 (major)

**Cargo — old Rust crates:**

- `itertools` 0.10.5 → 0.14.0 (4 majors behind)
- `nom` 7.1.1 → 8.0.0 (major)
- `test-case` 2.2.2 → 3.3.1 (major)
- `color-eyre` 0.6.2 → 0.6.5 (patch)

**mise tools:** all locked versions look current with their pinned majors. `biome=2` → `2.4.15` (current), `oxlint=1` → `1.64.0` (need to confirm against the lockfile). `prettier=3` is on the chopping block per the linter plan.

**Lockfile mess:** both `apps/djf.io` and `apps/ravrun` have a `pnpm-lock.yaml` *and* a `bun.lock` checked in. The skill should flag this as an escalation, not silently delete.

**`tsgo` status:** `@typescript/native-preview` exists but is `7.0.0-dev.*`. Pre-release; not ready for production wiring. Defer adoption per the linter plan.

## Phase 2 work completed

Scaffolded the skill and the slash command:

- `.claude/skills/dependency-freshness/SKILL.md` — full skill spec: ecosystems, workflow, classification, batching, verification, PR template, escalation policy.
- `.claude/commands/dependency-freshness.md` — slash command invoking the skill, with an optional ecosystem-filter argument.

The skill is documented but not yet "implemented" — there's no automation code; it's a Claude-driven workflow. That's intentional: the skill is the prompt.

## Decisions made today

- Skill lives in repo at `.claude/skills/dependency-freshness/SKILL.md`. Slash command at `.claude/commands/dependency-freshness.md`.
- Ecosystems handled out of the gate: npm, mise, Cargo. Go added when it appears.
- Joy-of-React projects are in scope for sweeps but low-priority on failures.
- Packages can opt out of automatic bumps via a `# freshness:hold` marker (TBD exact syntax for JSON manifests).

## Next steps

1. Build the cron path: `.github/workflows/dependency-freshness.yml` that runs Claude Code with the slash command on a weekly schedule. Need to decide auth/secrets approach — this is a likely **human-intervention task** (GitHub Actions secrets, Claude Code action setup).
2. First real sweep: run `/dependency-freshness npm` and see what the skill produces. Will need to bootstrap by installing deps locally — sandbox doesn't have `node_modules`.
3. Move the linter-standardization plan's "aspirational" Rust section to "in scope" — we have Rust now.

## Open questions

- Sweep cadence: weekly, biweekly, monthly? My lean: weekly for npm, monthly for mise + Cargo (those move slower in this repo).
- Where do escalation issues live — a label on the PR, a separate issue, or both? My lean: `needs-attention` label on the PR + an issue only when the bump genuinely can't be applied.
- Should the skill self-update mise's `prettier=3` pin given the linter plan wants prettier dropped, or leave that to the linter project?
