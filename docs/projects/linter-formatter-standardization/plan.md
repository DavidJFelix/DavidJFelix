# Standardize on Linters and Formatters

## Goal

Converge on a single, consistent set of linters and formatters across the entire monorepo so every app follows the same rules and there is no ambiguity about which tool owns which file type.

## Rationale

- Multiple apps currently have overlapping or inconsistent lint/format configs
- Developers (human and AI) shouldn't have to guess which tool to run
- A clear ownership map reduces CI complexity and eliminates conflicting fixes
- Builds on [Dev Tooling Consolidation](../dev-tooling-consolidation/plan.md) which hoists tools into mise; this project defines the authoritative ruleset

## Implementation

### Phase 1: Audit current state

- Inventory every lint/format config across apps (Biome, Oxlint, ESLint, Prettier, cspell, editorconfig)
- Document which tool currently owns each file type and where configs conflict

### Phase 2: Define the standard

- Decide the canonical tool for each file type:
  - JS/TS/JSX/TSX: Biome (lint + format)
  - JSON/JSONC: Biome (format)
  - CSS: Biome (lint + format)
  - Astro/Vue/Svelte: Biome (lint + format, with framework plugins)
  - Markdown/MDX: Prettier (format only)
  - Spell check: cspell
  - GitHub Actions: ghalint (see [ghalint-pinact](../ghalint-pinact/plan.md))
- Document the standard in a short reference (e.g. `docs/tooling-standard.md` or in CLAUDE.md)

### Phase 3: Migrate configs

- Remove any remaining ESLint configs
- Unify Biome and Oxlint rule sets across apps (single root config, app-level overrides only when necessary)
- Ensure Prettier is scoped strictly to Markdown/MDX

### Phase 4: CI and editor integration

- Single CI job that runs the full lint + format suite
- VS Code / editor settings that match the standard (format-on-save, correct formatter per language)

## Files

- `biome.jsonc` - root Biome config
- `.oxlintrc.json` - root Oxlint config
- `.prettierrc.json` / `.prettierignore` - Prettier (MD/MDX only)
- `.config/cspell.json` - spell check dictionary
- `.vscode/settings.json` - editor integration
- `apps/*/biome.jsonc` - per-app overrides (if any)
- `apps/*/.eslintrc*` - to be removed
