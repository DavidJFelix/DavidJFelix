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

| Concern     | Tool   | Config                | Enforced by                            |
| ----------- | ------ | --------------------- | -------------------------------------- |
| Spell check | cspell | `.config/cspell.json` | root `mise run spell` + `ci-spell.yml` |

### JavaScript / TypeScript

Applies to every JS/TS app (Astro, React, Vue, Svelte, TanStack Start, Nuxt, plain Node).

| Concern                                                         | Tool                                | Config                                                                |
| --------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Lint + format (JS/TS/JSX/TSX, JSON/JSONC, CSS, framework files) | Biome                               | root `biome.jsonc`, app `biome.json` extends it                       |
| Additional lint rules                                           | Oxlint                              | root `.oxlintrc.json`                                                 |
| Type checking                                                   | tsgo (`@typescript/native-preview`) | per-app `tsconfig.json`                                               |
| Markdown / MDX formatting                                       | Prettier (md/mdx only)              | root `.prettierrc.json` (`proseWrap: always`), root `.prettierignore` |

Biome owns every file type except Markdown/MDX. Revisit if Biome gains MD/MDX support.

### Rust _(aspirational — not yet implemented)_

| Concern | Tool    | Config                                            |
| ------- | ------- | ------------------------------------------------- |
| Lint    | clippy  | shared `clippy.toml` + lints in root `Cargo.toml` |
| Format  | rustfmt | shared `rustfmt.toml`                             |

Status: 0% implemented across the repo's exercise crates (Advent-of-Code 2022, Exercism). Depth is
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
  `ignorePaths` in `.config/cspell.json` (node_modules, build output, generated trees, lockfiles).
  The `ci-spell.yml` workflow runs it on every push and PR — no paths filter, because it's
  universal. Apps do **not** carry their own cspell dependency or `spell` script; the root gate
  covers them.
- **Biome + Oxlint + typecheck + tests** are per-app, declared as mise tasks in each
  `apps/<name>/mise.toml` and run by that app's path-filtered CI workflow. `mise run check` at the
  repo root fans every app's full check out (`bin/run-app-tasks.ts`).
- **Root config files** (`biome.jsonc`, `.oxlintrc.json`, etc.) are formatted by the root
  `mise run format` task and gated by `ci-repo.yml`.
- **Repo-owned Markdown** (`docs/`, root `*.md`, `.github/`) is format-gated by the root
  `mise run format:md` task (a bare `prettier --check .`, scope set by `.prettierignore`) and
  `ci-docs.yml`. Apps are excluded — their per-app format gates own their markdown, and djf.io's
  blog content keeps its semantic line breaks via the app's own `.prettierignore`. The legacy dirs
  and the hash-locked `.agents/` skills are excluded too.

## Known caveats / open decisions

- **Legacy directories are out of scope.** `Advent-of-Code/`, `Exercism/`, and `Joy-of-React/` are
  excluded from the spell gate and have no lint/format CI; whether to wire them in, document them
  out, or archive them is undecided.
