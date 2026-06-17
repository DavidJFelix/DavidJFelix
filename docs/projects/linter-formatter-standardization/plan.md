# Standardize on Linters and Formatters

## Goal

Converge on a single, consistent set of linters, formatters, and checkers across the entire monorepo. For each language ecosystem, one canonical tool owns each concern; like-projects share the same config.

## Rationale

- Multiple apps currently have overlapping or inconsistent lint/format configs
- Developers (human and AI) shouldn't have to guess which tool to run
- A clear ownership map reduces CI complexity and eliminates conflicting fixes
- Polyglot from the start: today's repo is JS-heavy, but planned work brings Rust and Go in

## The Standard

### Universal

- **Spell check**: `cspell` (applies to all file types, all projects)

### JavaScript / TypeScript ecosystem

Applies to all JS/TS-based apps (Astro, React, Vue, Svelte, TanStack Start, plain Node, etc.).

- **Lint + format** (JS/TS/JSX/TSX, JSON/JSONC, CSS, framework files): **Biome**
- **Additional lint rules**: **Oxlint**
- **Type checking**: **tsgo** (the Go port of TypeScript v7) — part of the checks suite, not the lint suite
- **Markdown / MDX formatting**: **Prettier**, scoped to md/mdx only (root `.prettierrc.json`, `proseWrap: always`; app scripts pass explicit `**/*.{md,mdx}` globs). Biome owns every other file type. Revisit if Biome gains MD/MDX support. Exception: `apps/djf.io/src/content/` is excluded (app-level `.prettierignore`) — blog posts are authored with semantic line breaks and should not be rewrapped.

Open to revisiting Biome later, but it's currently the right tool.

### Rust ecosystem

In repo today: workspace at root (`Cargo.toml`), members under `Advent-of-Code/2022/rust/*`, plus standalone crates under `Exercism/rust/*`.

- **Lint**: `clippy` with an extensive ruleset, shared across projects (root `clippy.toml` + workspace-level lint config in root `Cargo.toml`)
- **Format**: `rustfmt` with a shared `rustfmt.toml`

**Status (2026-06-11 audit): 0% implemented.** No `clippy.toml`, no
`rustfmt.toml`, no lint config in root `Cargo.toml`, no Rust CI of any kind —
across 22 crates (14 Advent-of-Code 2022 workspace members, 8 standalone
Exercism crates). **Decision pending** (see Open scope decisions below): all of
these crates are exercise code, so the extensive-ruleset plan above may be
oversized — minimal enforcement (default clippy + `cargo fmt --check` in CI) or
an explicit scope-out are on the table until a real Rust project exists.

### Go ecosystem (aspirational — no Go in repo today)

- **Lint**: `golangci-lint` (or whatever the current consensus tool is at adoption time), shared rules
- **Format**: `gofmt` / `goimports`

### Principle

Same ecosystem → same config. Per-project overrides only when there's a real, documented reason.

## Remaining work (2026-06-11 audit)

A full audit (see [2026-06-11-progress.md](./2026-06-11-progress.md)) found the
remaining scope is 2–4 sessions, not polish. The decision-free mechanical slice
landed 2026-06-16 (see [2026-06-16-progress.md](./2026-06-16-progress.md)); the
Rust gap above and the scope decisions below remain.

- ~~**cspell is configured but enforced nowhere.**~~ **DONE 2026-06-16.** cspell
  is now a root tool (mise `npm:cspell`) run by `mise run spell` and enforced on
  every push/PR by `ci-spell.yml`. The redundant per-app `spell` scripts and
  cspell devDependencies were removed; the backlog was triaged (dictionary
  additions + ignore generated trees) to a green gate.
- ~~**Root `.prettierignore` is non-functional.**~~ **DONE 2026-06-16.** Rewritten
  to the working `**` + `!*/` recipe; a bare `prettier .` now touches only md/mdx
  and descends the tree. (Enforcing format across `docs/` is still gated on the
  root-markdown decision below.)
- **Unscoped directories.** `Joy-of-React/` (two projects with Biome configs
  extending root, but no CI) and `Advent-of-Code/2020/*/typescript` (eight
  projects with no lint/format configs at all) sit outside the standard with no
  recorded decision.
- ~~**Config drift.**~~ **DONE 2026-06-16.** davidjfelix.com and djf.io bumped to
  Biome schema 2.4.16.
- ~~**Phase 4 doc missing.**~~ **DONE 2026-06-16.** `docs/tooling-standard.md`
  added; CLAUDE.md tooling section now carries cspell, tsgo, and Rust entries.

Not a gap: tsgo is a proper per-app devDependency (`@typescript/native-preview`)
in the apps that use it — but it is pinned to `latest`, which was handed to the
dependency-freshness project to pin when Renovate coverage extends.

### Open scope decisions (block the big items)

1. **Rust**: full standard per the plan, minimal (default clippy +
   `cargo fmt --check` CI), or scope out as exercise code until a real Rust
   project exists? Recommendation: minimal or scope-out.
2. **Legacy JS dirs** (Joy-of-React, Advent-of-Code 2020 TS): wire into the
   standard, document as out of scope, or archive/delete?
3. **Root markdown**: format all of `docs/` with `proseWrap: always` (one-time
   churn across 40+ files, including semantic-line-break-authored notes) or
   exclude docs from prose rewrapping and enforce only on new surfaces?

The no-decision-needed slice (cspell wiring, `.prettierignore` fix, Biome
schema bumps, tooling-standard doc) is about one session of mechanical work
and can proceed independently.

## Implementation

### Phase 1: Audit current state

- Inventory every lint/format/check config across apps
- Document which tool currently owns each file type and where configs conflict
- Capture any per-app overrides that need to stay vs. those that should be deleted

### Phase 2: Migrate JS/TS configs

- Remove any remaining ESLint configs
- Hoist Biome and Oxlint configs to root; app-level overrides only when necessary
- Wire tsgo in place of `tsc` for type checking
- Confirm cspell coverage is repo-wide

### Phase 3: CI and editor integration

- Single CI job that runs the full lint + format + check + spell suite
- VS Code / editor settings that match the standard (format-on-save, correct formatter per language)

### Phase 3b: Per-project subtree checks — DONE 2026-06-09

When a project's subtree changes (or its build is triggered), CI runs that project's own type checks, linters, format checks, tests, and build — not just the repo-wide suite.

Landed: per-app `mise.toml` task declarations (`typecheck`, `lint`, `format`, `test`, `build`, `check` umbrella) in all five apps, per-app CI workflows for all five apps (calendar-visualizer, davidjfelix.com, and ravrun had none before), CI jobs invoke `mise run <task>`. Change detection is the per-app workflow paths-filter pattern. See [2026-06-09-progress.md](./2026-06-09-progress.md) for the check coverage matrix — calendar-visualizer, davidjfelix.com, and ravrun still lack test suites.

- Each app declares its check commands (typecheck, lint, format, test, build) in a known, discoverable form (mise tasks preferred)
- CI detects which project subtrees changed in a PR and runs only those projects' checks
- Repo-wide checks (cspell, root Biome/Oxlint) continue to run on every PR
- One canonical entry point per app so contributors (human and AI) don't have to memorize per-app conventions

### Phase 4: Document

- Short reference doc (e.g. `docs/tooling-standard.md` or a section in CLAUDE.md) listing the ownership map per ecosystem
- Update CLAUDE.md tooling section to reflect tsgo addition

## Files

- `biome.jsonc` - root Biome config
- `.oxlintrc.json` - root Oxlint config
- `.config/cspell.json` - spell check dictionary
- `.vscode/settings.json` - editor integration
- `apps/*/biome.jsonc` - per-app overrides (only when necessary)
- `apps/*/.eslintrc*` - to be removed
- `apps/*/.prettierrc*` - to be removed if present
