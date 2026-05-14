---
name: dependency-freshness
description: Discover, evaluate, apply, and PR dependency updates across the monorepo. Use when the user invokes /dependency-freshness, runs the freshness GitHub Action, or asks to "check for updates" / "bump deps" / "refresh dependencies". Handles npm, mise-managed tools, and Cargo. Splits patch+minor batches per ecosystem, majors and known-incompatible bumps into their own PRs.
---

# Dependency Freshness Skill

This skill keeps the repo's packages and tools current. It runs in two modes: locally via the `/dependency-freshness` slash command, and on cron via a GitHub Action. The behavior is the same — only the trigger differs.

## Ecosystems covered

1. **npm** — every `package.json` outside `node_modules` (see Discovery below). Each app has its own `pnpm-lock.yaml`; there is no root pnpm workspace today.
2. **mise** — tools in `.config/mise.toml` (`mise.lock` is the source of truth for resolved versions).
3. **Cargo** — Rust workspace at the repo root, members under `Advent-of-Code/2022/rust/*` plus standalone crates under `Exercism/rust/*`.

If new ecosystems appear (Go, etc.), extend this skill rather than forking it.

## Workflow

For each run:

### 1. Discover

Build a single list of `(ecosystem, project, package, current, latest)` rows.

- **npm**: for each `package.json` outside `node_modules`, run `pnpm outdated --format json` (or equivalent). Capture dependencies and devDependencies.
- **mise**: parse `.config/mise.toml`. For each tool, look up the latest via `mise latest <tool>`.
- **Cargo**: for each `Cargo.toml`, run `cargo outdated` (if installed) or compare `[dependencies]` entries to `cargo search <crate> --limit 1`.

Skip packages pinned to an exact version with an inline comment marker `# freshness:hold` (or equivalent for JSON — a sibling `freshness-hold` field in a `_meta` block).

### 2. Classify each update

For every row:

- **Semver delta**: patch / minor / major / non-semver.
- **Non-semver flag**: if the package is known not to follow semver (maintain a small list in `meta/non-semver.json` within the skill dir), tag it.
- **Risk**: pull the upstream changelog or release notes (GitHub releases, the package's CHANGELOG, or `npm view <pkg>@<latest> deprecated`). Look for `BREAKING`, `removed`, `deprecated`, `migration`.

### 3. Group into PR batches

- One batch per ecosystem for **patch + minor** updates (e.g. `chore(deps): npm patch+minor sweep`).
- One PR per **major** update (per package), e.g. `chore(deps): bump react 18 → 19`.
- One PR per **known-incompatible** update, isolated. Still apply, but flag clearly.

For non-semver-flagged packages, default to isolated PRs even on apparent "patch" bumps.

### 4. Apply

For each batch:

1. Create a branch: `chore/deps/<ecosystem>-<date>` for sweeps, `chore/deps/<package>-<from>-<to>` for singles.
2. Update the manifest(s). Refresh lockfiles in place.
3. Install deps for affected projects.
4. Run the verification step (next section).
5. Commit. Push. Open a PR using the GitHub MCP tools.

### 5. Verify

Per project touched by the batch:

- Run the project's `lint`, `test` (or `test:unit` if both unit and e2e exist), and `build` scripts when they exist.
- For Cargo crates: `cargo check` + `cargo test`.
- For mise tool bumps: run `mise install` and any project script that exercises that tool (e.g. `pnpm lint` for biome/oxlint bumps).

Capture stdout/stderr and the exit code per script for the PR body.

### 6. PR body template

Each PR body MUST include:

```
## Updates

| Package | From | To | Δ | Notes |
| --- | --- | --- | --- | --- |
| ... | ... | ... | minor | ... |

## Changelog excerpts

<one collapsed `<details>` per package with the relevant release notes>

## Verification

- [x] `pnpm lint` (apps/djf.io) — passed
- [x] `pnpm test:unit` (apps/djf.io) — passed
- [ ] `pnpm build` (apps/djf.io) — **failed** (see below)

<failure logs in `<details>`>

## Risks

- Non-semver: `foo@1.2.3 → 1.2.4` — patch version, but `foo` does not follow semver. Review carefully.
- Major: react 18 → 19 — see migration notes.
```

If verification fails on an isolated update, still open the PR but mark it as `draft`, add the `needs-attention` label, and put the failure summary at the top.

### 7. Escalation

Default channel is the **`needs-attention` label on the PR**. Open a separate follow-up issue (assigned to `@DavidJFelix`, following the Human Intervention Task format in `CLAUDE.md`) only when:

- The bump cannot be applied automatically (requires code changes the skill is not confident to make).
- A package is deprecated upstream and a replacement is needed.
- The bump is blocked on something outside the repo (a credential, a third-party account decision, etc.).

If the skill can open a draft PR with a clear failure log, prefer the label. Reserve issues for things a PR cannot represent.

## Discovery details

- Treat all `package.json` files outside `node_modules`, `dist`, `build`, `.next`, `.astro` as in-scope.
- Currently in scope: `apps/djf.io`, `apps/calendar-visualizer`, `apps/davidjfelix.com`, `apps/ravrun`, `Joy-of-React/project-wordle`, `Joy-of-React/project-toast`.
- `Joy-of-React/*` projects are learning exercises — they are in scope for freshness but a failing verification there should be a low-priority issue, not a blocker.

## Lockfile hygiene

While running, verify each project has exactly one lockfile. If both `pnpm-lock.yaml` and `bun.lock` exist (as in `apps/djf.io` and `apps/ravrun` today), surface this as an escalation issue — do not silently delete either.

## Triggers

- **Slash command**: `/dependency-freshness` — see `.claude/commands/dependency-freshness.md`.
- **Cron**: GitHub Action at `.github/workflows/dependency-freshness.yml` (not yet created — see project plan).

## What this skill is not

- Not a security-update tool — Dependabot/GitHub vuln alerts still own that lane.
- Not a one-shot migration tool. For deep framework upgrades (e.g. Astro 5 → 6 across several APIs), the skill flags the bump and stops; a human (or another targeted session) does the migration.
