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
- **Markdown / MDX formatting**: **Biome** if/when it supports MD/MDX. Until then, MD/MDX is unformatted by automation. We do **not** add Prettier.

Open to revisiting Biome later, but it's currently the right tool.

### Rust ecosystem

In repo today: workspace at root (`Cargo.toml`), members under `Advent-of-Code/2022/rust/*`, plus standalone crates under `Exercism/rust/*`.

- **Lint**: `clippy` with an extensive ruleset, shared across projects (root `clippy.toml` + workspace-level lint config in root `Cargo.toml`)
- **Format**: `rustfmt` with a shared `rustfmt.toml`

### Go ecosystem (aspirational — no Go in repo today)

- **Lint**: `golangci-lint` (or whatever the current consensus tool is at adoption time), shared rules
- **Format**: `gofmt` / `goimports`

### Principle

Same ecosystem → same config. Per-project overrides only when there's a real, documented reason.

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
