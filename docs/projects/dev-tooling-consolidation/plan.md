# Dev Tooling Consolidation

## Goal

Consolidate dev tooling (linting, formatting, spell-checking) to root-level configuration managed via mise, so each app doesn't independently install the same tools. Add Prettier scoped to Markdown/MDX files (the only gap Biome can't cover). Upgrade Biome and Oxlint to latest major versions.

## Rationale

- Biome 2.0 -> 2.4: bug fixes, new rules, Astro/Vue/Svelte support improvements
- Oxlint 0.16 -> 1.x: stable release, new rules, performance improvements
- Prettier for MD/MDX: Biome has no Markdown formatter; Prettier is the only option
- mise manages tool versions centrally, removing duplicate devDependencies across apps

## Implementation

### Phase 1: Root tooling via mise

- Add `biome`, `oxlint`, `prettier` to `.config/mise.toml`
- Remove `@biomejs/biome`, `oxlint` from each app's `devDependencies`
- Keep `cspell` and `@cspell/dict-typescript` in app devDeps (used per-app)

### Phase 2: Config upgrades

- Upgrade `biome.jsonc` schema to 2.4
- Update `.oxlintrc.json` for v1.x compatibility
- Consolidate `.editorconfig` to root (remove app-level duplicates)

### Phase 3: Prettier for Markdown

- Add `.prettierrc.json` at root (matching Biome's style: single quotes, no semis, etc.)
- Add `.prettierignore` excluding everything except `*.md` and `*.mdx`

### Phase 4: Editor integration

- Configure `.vscode/settings.json` for format-on-save
  - Biome as default formatter for JS/TS/JSON/CSS
  - Prettier as formatter for Markdown/MDX

## Files

- `.config/mise.toml` - tool versions
- `biome.jsonc` - root Biome config
- `.oxlintrc.json` - root Oxlint config
- `.prettierrc.json` - Prettier config (MD/MDX only)
- `.prettierignore` - scope Prettier to MD/MDX
- `.editorconfig` - root editor config
- `.vscode/settings.json` - VS Code integration
- `apps/*/package.json` - remove hoisted devDeps
