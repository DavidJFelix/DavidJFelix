# Tooling Standard

The canonical map of which tool owns which concern, per ecosystem. The rule:
**one tool owns each concern, like-projects share one config.** Per-project
overrides only when there's a real, documented reason.

This document is the reference; the live config lives in `.config/`, root
`biome.jsonc` / `.oxlintrc.json` / `.prettierrc.json`, and each app's
`apps/<name>/` configs.

## Ownership map

### Universal (all file types, all projects)

| Concern     | Tool   | Config                | Enforced by                              |
| ----------- | ------ | --------------------- | ---------------------------------------- |
| Spell check | cspell | `.config/cspell.json` | root `mise run spell` + `ci-spell.yml`   |

### JavaScript / TypeScript

Applies to every JS/TS app (Astro, React, Vue, Svelte, TanStack Start, Nuxt, plain Node).

| Concern                          | Tool                              | Config                                  |
| -------------------------------- | --------------------------------- | --------------------------------------- |
| Lint + format (JS/TS/JSX/TSX, JSON/JSONC, CSS, framework files) | Biome | root `biome.jsonc`, app `biome.json` extends it |
| Additional lint rules            | Oxlint                            | root `.oxlintrc.json`                    |
| Type checking                    | tsgo (`@typescript/native-preview`) | per-app `tsconfig.json`               |
| Markdown / MDX formatting        | Prettier (md/mdx only)            | root `.prettierrc.json` (`proseWrap: always`), root `.prettierignore` |

Biome owns every file type except Markdown/MDX. Revisit if Biome gains MD/MDX support.

### Rust *(aspirational — not yet implemented)*

| Concern | Tool    | Config                                       |
| ------- | ------- | -------------------------------------------- |
| Lint    | clippy  | shared `clippy.toml` + lints in root `Cargo.toml` |
| Format  | rustfmt | shared `rustfmt.toml`                         |

Status: 0% implemented across the repo's exercise crates (Advent-of-Code 2022,
Exercism). Depth is an open decision — full ruleset vs. minimal (default clippy +
`cargo fmt --check`) vs. scope-out until a real Rust project exists.

### Go *(aspirational — no Go in the repo today)*

| Concern | Tool                | 
| ------- | ------------------- |
| Lint    | golangci-lint       |
| Format  | gofmt / goimports   |

## How enforcement is wired

- **Spell check** is a single repo-wide gate. cspell is a root tool (mise's npm
  backend: `npm:cspell` in `.config/mise.toml`), run via `mise run spell` over the
  repo's own sources (`apps/`, `docs/`, `bin/`, root markdown, `.config/`, `.github/`).
  Noise is filtered by `ignorePaths` in `.config/cspell.json` (node_modules, build
  output, generated trees, lockfiles). The `ci-spell.yml` workflow runs it on every
  push and PR — no paths filter, because it's universal. Apps do **not** carry their
  own cspell dependency or `spell` script; the root gate covers them.
- **Biome + Oxlint + typecheck + tests** are per-app, declared as mise tasks in each
  `apps/<name>/mise.toml` and run by that app's path-filtered CI workflow. `mise run
  check` at the repo root fans every app's full check out (`bin/run-app-tasks.ts`).
- **Root config files** (`biome.jsonc`, `.oxlintrc.json`, etc.) are formatted by the
  root `mise run format` task and gated by `ci-repo.yml`.

## Known caveats / open decisions

- **Root Markdown is not yet format-enforced.** `.prettierignore` is now correct (a
  bare `prettier .` only touches md/mdx and descends the tree), but no CI gate runs
  Prettier over `docs/`. Enforcing `proseWrap: always` would rewrap 40+ existing docs
  — including semantic-line-break-authored notes — so it's deferred pending a decision
  on one-time churn vs. enforcing only on new surfaces.
- **Legacy directories are out of scope.** `Advent-of-Code/`, `Exercism/`, and
  `Joy-of-React/` are excluded from the spell gate and have no lint/format CI; whether
  to wire them in, document them out, or archive them is undecided.
