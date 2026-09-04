# Tooling Standard

The canonical map of which tool owns which concern, per ecosystem. The rule: **one tool owns each
concern, like-projects share one config.** Per-project overrides only when there's a real,
documented reason.

This document is the reference; the live config lives in `.config/`, `.oxfmtrc.json` /
`.prettierrc.json` at the repo root, `biome.jsonc` / `.oxlintrc.jsonc` at the web-apps workspace
root, and each project's own configs under `workspaces/web-apps/`.

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

| Concern                                                                 | Tool                         | Config                                                                |
| ----------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Lint, primary (JS/TS/JSX/TSX + astro/vue/svelte script blocks)          | Oxlint                       | workspace `.oxlintrc.jsonc`                                           |
| Lint, residual (CSS lint + the JS rules oxlint lacks; pruned rule list) | Biome                        | workspace `biome.jsonc`, app `biome.json` extends it                  |
| Format (JS/TS/JSX/TSX, JSON/JSONC, CSS, Vue)                            | oxfmt                        | root `.oxfmtrc.json`                                                  |
| Format (`.astro` frontmatter, `.svelte` script blocks)                  | Biome                        | workspace `biome.jsonc` (`formatter.includes`)                        |
| Import organizing                                                       | Biome assist                 | workspace `biome.jsonc`                                               |
| Type checking                                                           | tsc (`typescript` 7, native) | per-app `tsconfig.json`                                               |
| Markdown / MDX formatting                                               | Prettier (md/mdx only)       | root `.prettierrc.json` (`proseWrap: always`), root `.prettierignore` |

Oxlint is the primary linter and oxfmt the primary formatter; Biome remains only where oxc does not
reach -- CSS linting, a pruned list of JS rules oxlint has no equivalent for, `.astro`/`.svelte`
formatting, and import organizing. Rule-level coverage was proven during the migration by a
lint-parity kit (one violating fixture per previously-active Biome rule, asserted against the engine
that took it over); the kit was removed after passing and lives in git history on the migration PR.
Revisit the Biome remainder as oxlint/oxfmt grow (svelte/astro formatting, CSS linting, import
sorting).

Type checking is the native `tsc` (`typescript` 7) wherever the check is bare tsc. Framework apps
keep their framework checker -- `astro check`, `svelte-check`, `vue-tsc` (via `nuxt typecheck`) --
and those embed the TypeScript JS compiler API that the native compiler no longer ships. The Astro
apps still run `typescript` 7: `@astrojs/check` resolves its TypeScript peer beside its own
instance, so it is declared once at the web-apps workspace root next to a `typescript` 6 devDep --
`astro check` in each app walks up to that copy and never sees the app's 7 (rationale note in the
workspace `bunfig.toml`). The Svelte and Nuxt apps pin `typescript` 6 outright -- `svelte-check` and
`vue-tsc` resolve TypeScript from the project, so there is no seam for a second copy. Renovate holds
the pinned spots below 7 until the checkers support TS 7, expected around 7.1.

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

- **Runtime**: Node 26 and bun, both managed via mise. `.config/mise.toml` declares tools and
  version ranges; `.config/mise.lock` pins exact versions. Whenever you add a tool or bump a
  version, run `mise install` and commit the resulting `mise.lock` change in the same PR -- CI fails
  on a stale lockfile. (If `mise install` hits the GitHub releases API rate limit, set
  `GITHUB_TOKEN` -- a no-scope PAT works -- and retry. Do not skip the lockfile update.)
- **JS/TS package manager**: `bun` -- installer (`bun install`), script runner (`bun run`), and
  local-bin runner (`bun x`). Node stays the toolchain runtime: vitest, Playwright, wrangler, and
  the framework CLIs all run on the mise-pinned node, and `bun test` does not replace vitest. `npm`
  projects should be converted unless there's a good reason; `yarn` and `pnpm` are retired (the two
  legacy `workspaces/joy-of-react` trees still carry pnpm lockfiles and migrate when next touched).
  The web apps and their shared packages form one bun workspace rooted at `workspaces/web-apps/`, so
  a single `bun install` there covers every project and shared code resolves through workspace links
  -- no per-project install ordering, and no `file:` dependency to install first. The workspace root
  owns the settings that used to be copied per project: one `bunfig.toml` with
  `minimumReleaseAge = 86400` (bun's release-age cooldown is off by default and the file is not
  inherited from parent directories), and one `trustedDependencies` allowlist for native build
  scripts -- note that declaring the field replaces bun's default trust list, so it must name
  everything any project relies on (esbuild, workerd, sharp, and friends), not just additions.
  Dependency `overrides` also apply workspace-wide and live in the root package.json.
- **Lockfiles**: one per package-manager root. That is one `bun.lock` for the whole
  `workspaces/web-apps/` workspace, plus one for each isolated tree under `workspaces/`. If a root
  has both `pnpm-lock.yaml` and `bun.lock`, keep `bun.lock` and delete `pnpm-lock.yaml`.
- **Python**: `uv`. `pip` is banned -- never invoke it directly. `poetry` is banned.
- **Rust**: `cargo`. **Go**: `go mod`.
- **Tasks & scripts**: prefer `mise` tasks; Turborepo (`npm:turbo`, pinned in mise) fans them out
  across the web-apps workspace and owns the caching. If a task is too complex for a mise task,
  write it as a `bun` script in a `bin/` directory -- the full language-choice order and the
  `sed`/`perl` ban (which includes CI) live in [scripting-style.md](scripting-style.md). Remove
  `justfile`s when found. Do not introduce new task tooling (moon, Taskfile, etc.) without an
  explicit ask.
- **Deployment**: Cloudflare. (Vercel has been dropped -- remove references when encountered.)
  Pulumi / SST / Alchemy may come in later; not needed yet.

## How enforcement is wired

- **Spell check** is a single repo-wide gate. cspell is a root tool (mise's npm backend:
  `npm:cspell` in `.config/mise.toml`), run via `mise run spell` over the repo's own sources
  (`workspaces/web-apps/`, `docs/`, `bin/`, root markdown, `.config/`, `.github/`). Noise is
  filtered by `ignorePaths` in `.config/cspell.jsonc` (node_modules, build output, generated trees,
  lockfiles). The `ci-spell.yml` workflow runs it on every push and PR — no paths filter, because
  it's universal. CI runs `mise run spell:ci`, the same check with the JUnit reporter swapped in on
  the command line, and uploads the report so Depot's test results view lists each misspelling. Apps
  do **not** carry their own cspell dependency or `spell` script; the root gate covers them.
- **Oxlint + Biome + oxfmt + typecheck + tests** are per-project scripts in each project's
  package.json, mirrored as mise tasks in its `mise.toml` for working inside one app. Turborepo
  orchestrates them across the workspace: `mise run check` at the repo root runs the whole graph
  through `bin/turbo-run.ts`, and one `ci-web-apps.yml` workflow does the same in CI. What actually
  executes is decided by the dependency graph and the cache, not by path filters -- a change to a
  shared package re-runs its consumers because they depend on it.
- **Root config files** (`.oxfmtrc.json`, `.prettierrc.json`, the workspace's `biome.jsonc` and
  `.oxlintrc.jsonc`, etc.) are formatted by the root `mise run format` task (oxfmt, plus a Biome
  lint of Biome's own configs) and gated by `ci-repo.yml`.
- **Repo-owned Markdown** (`docs/`, root `*.md`, `.github/`) is format-gated by the root
  `mise run format:md` task (a bare `prettier --check .`, scope set by `.prettierignore`) and
  `ci-docs.yml`. Apps are excluded — their per-app format gates own their markdown, and djf.io's
  blog content keeps its semantic line breaks via the app's own `.prettierignore`. The legacy dirs
  and the hash-locked `.agents/` skills are excluded too.

## Known caveats / open decisions

- **Legacy directories and the isolated workspace trees are out of scope.** `Exercism/` and the
  non-`web-apps` trees under `workspaces/` are excluded from the spell gate and have no root-owned
  lint/format CI. They own their own tooling blast radius and can opt into checks later.
  `workspaces/web-apps/` is the exception: it is fully in scope, gated by `ci-web-apps.yml`.
