# Tooling Standard

The canonical map of which tool owns which concern, per ecosystem. The rule: **one tool owns each
concern, like-projects share one config.** Per-project overrides only when there's a real,
documented reason.

This document is the reference; the live config lives in `.config/`, root `biome.jsonc` /
`.oxlintrc.json` / `.prettierrc.json`, and each app's `apps/<name>/` configs.

For _where_ those config files live and _what format_ they take, see
[configuration-style.md](configuration-style.md); for which language to write a script in, see
[scripting-style.md](scripting-style.md).

## Ownership map

### Universal (all file types, all projects)

| Concern     | Tool   | Config                 | Enforced by                            |
| ----------- | ------ | ---------------------- | -------------------------------------- |
| Spell check | cspell | `.config/cspell.jsonc` | root `mise run spell` + `ci-spell.yml` |

### JavaScript / TypeScript

Applies to every JS/TS app (Astro, React, Vue, Svelte, TanStack Start, Nuxt, plain Node).

| Concern                                                                 | Tool                                | Config                                                                |
| ----------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Lint, primary (JS/TS/JSX/TSX + astro/vue/svelte script blocks)          | Oxlint                              | root `.oxlintrc.json`                                                 |
| Lint, residual (CSS lint + the JS rules oxlint lacks; pruned rule list) | Biome                               | root `biome.jsonc`, app `biome.json` extends it                       |
| Format (JS/TS/JSX/TSX, JSON/JSONC, CSS, Vue)                            | oxfmt                               | root `.oxfmtrc.json`                                                  |
| Format (`.astro` frontmatter, `.svelte` script blocks)                  | Biome                               | root `biome.jsonc` (`formatter.includes`)                             |
| Import organizing                                                       | Biome assist                        | root `biome.jsonc`                                                    |
| Type checking                                                           | tsgo (`@typescript/native-preview`) | per-app `tsconfig.json`                                               |
| Markdown / MDX formatting                                               | Prettier (md/mdx only)              | root `.prettierrc.json` (`proseWrap: always`), root `.prettierignore` |

Oxlint is the primary linter and oxfmt the primary formatter; Biome remains only where oxc does not
reach -- CSS linting, a pruned list of JS rules oxlint has no equivalent for, `.astro`/`.svelte`
formatting, and import organizing. Rule-level coverage was proven during the migration by a
lint-parity kit (one violating fixture per previously-active Biome rule, asserted against the engine
that took it over); the kit was removed after passing and lives in git history on the migration PR.
Revisit the Biome remainder as oxlint/oxfmt grow (svelte/astro formatting, CSS linting, import
sorting).

### Rust _(aspirational — not yet implemented)_

| Concern | Tool    | Config                                            |
| ------- | ------- | ------------------------------------------------- |
| Lint    | clippy  | shared `clippy.toml` + lints in root `Cargo.toml` |
| Format  | rustfmt | shared `rustfmt.toml`                             |

Status: 0% implemented across the repo's exercise crates (Advent of Code 2022, Exercism). Depth is
an open decision — full ruleset vs. minimal (default clippy + `cargo fmt --check`) vs. scope-out
until a real Rust project exists.

### Go _(aspirational — no Go in the repo today)_

| Concern | Tool              |
| ------- | ----------------- |
| Lint    | golangci-lint     |
| Format  | gofmt / goimports |

## Ecosystem defaults

The ownership map above covers quality tooling; this covers the rest of what agents reach for.

- **Runtime**: Node 26, pnpm, bun -- all managed via mise. `.config/mise.toml` declares tools and
  version ranges; `.config/mise.lock` pins exact versions. Whenever you add a tool or bump a
  version, run `mise install` and commit the resulting `mise.lock` change in the same PR -- CI fails
  on a stale lockfile. (If `mise install` hits the GitHub releases API rate limit, set
  `GITHUB_TOKEN` -- a no-scope PAT works -- and retry. Do not skip the lockfile update.)
- **JS/TS package manager**: `bun` is preferred when a project does not also need a Node toolchain.
  `pnpm` is the accepted default for the Node ecosystem; `npm` projects should be converted unless
  there's a good reason. `yarn` is banned. (Open question: whether Cloudflare Wrangler works
  bun-only -- until confirmed, Wrangler projects stay on pnpm.)
- **Lockfiles**: one per project. If a project has both `pnpm-lock.yaml` and `bun.lock`, keep
  `pnpm-lock.yaml` and delete `bun.lock`.
- **Python**: `uv`. `pip` is banned -- never invoke it directly. `poetry` is banned.
- **Rust**: `cargo`. **Go**: `go mod`.
- **Tasks & scripts**: prefer `mise` tasks. If a task is too complex for a mise task, write it as a
  `bun` script in a `bin/` directory -- the full language-choice order and the `sed`/`perl` ban
  (which includes CI) live in [scripting-style.md](scripting-style.md). Remove `justfile`s when
  found. Do not introduce new task tooling (moon, Taskfile, etc.) without an explicit ask.
- **Deployment**: Cloudflare. (Vercel has been dropped -- remove references when encountered.)
  Pulumi / SST / Alchemy may come in later; not needed yet.

## How enforcement is wired

- **Spell check** is a single repo-wide gate. cspell is a root tool (mise's npm backend:
  `npm:cspell` in `.config/mise.toml`), run via `mise run spell` over the repo's own sources
  (`apps/`, `docs/`, `bin/`, root markdown, `.config/`, `.github/`). Noise is filtered by
  `ignorePaths` in `.config/cspell.jsonc` (node_modules, build output, generated trees, lockfiles).
  The `ci-spell.yml` workflow runs it on every push and PR — no paths filter, because it's
  universal. Apps do **not** carry their own cspell dependency or `spell` script; the root gate
  covers them.
- **Oxlint + Biome + oxfmt + typecheck + tests** are per-app, declared as mise tasks in each
  `apps/<name>/mise.toml` and run by that app's path-filtered CI workflow. `mise run check` at the
  repo root fans every app's full check out (`bin/run-app-tasks.ts`).
- **Root config files** (`biome.jsonc`, `.oxlintrc.json`, `.oxfmtrc.json`, etc.) are formatted by
  the root `mise run format` task (oxfmt, plus a Biome lint of Biome's own configs) and gated by
  `ci-repo.yml`.
- **Repo-owned Markdown** (`docs/`, root `*.md`, `.github/`) is format-gated by the root
  `mise run format:md` task (a bare `prettier --check .`, scope set by `.prettierignore`) and
  `ci-docs.yml`. Apps are excluded — their per-app format gates own their markdown, and djf.io's
  blog content keeps its semantic line breaks via the app's own `.prettierignore`. The legacy dirs
  and the hash-locked `.agents/` skills are excluded too.

## Known caveats / open decisions

- **Legacy directories and workspace trees are out of scope.** `Exercism/` and `workspaces/` are
  excluded from the spell gate and have no root-owned lint/format CI. Workspace trees own their own
  tooling blast radius and can opt into checks later.
