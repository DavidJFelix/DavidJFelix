# Claude Code Guidelines

## Project Documentation

All project documentation MUST follow these conventions:

### Directory Structure

```
docs/
├── projects.md                          # Summary of all ongoing projects with links
└── projects/
    └── <project-name>/                  # Lowercase kebab-case project directory
        ├── plan.md                      # Project plan with goals, phases, and links
        └── YYYY-MM-DD-progress.md       # Progress notes (one per session)
```

### Naming Conventions

- **IMPERATIVE**: All project directories and files MUST use lowercase kebab-case naming
- Project directories: `blog-migration`, `api-refactor`, `design-system`
- Progress files: `2026-01-13-progress.md`, `2026-01-14-progress.md`
- Plan files: Always named `plan.md`

### Creating a New Project

1. Create directory: `docs/projects/<project-name>/`
2. Create `plan.md` with:
   - Project goal and rationale
   - Phased implementation plan
   - Links to relevant files and resources
3. Create initial progress file: `YYYY-MM-DD-progress.md`
4. Add entry to `docs/projects.md` with link to plan

### Closing a Project

Project directories are working notes, not history. When a project is complete:

1. Ensure the work is captured in `docs/changelog/`
2. Delete the entire `docs/projects/<project-name>/` directory
3. Remove the entry from `docs/projects.md`

The changelog is the durable record. `docs/projects.md` should reflect only active work.

### Progress File Format

Each progress file should contain:
- Date and session summary
- Work completed
- Decisions made
- Next steps
- Any blockers or open questions

## Human Intervention Tasks

When a task can't be completed by the agent — it requires David's hands on a local machine, a credential, a third-party account decision, a DNS change, a physical device, etc. — do not bury it in a progress note. Open a GitHub issue and assign it to `@DavidJFelix`.

Each such issue MUST contain:

- **Background** — 1-3 sentences on why this needs a human, and why now.
- **Steps** — a markdown checklist (`- [ ]`) of concrete actions. One verb per step. Each step independently checkable.
- **Automation follow-up** — how we avoid doing this manually next time (a tool to install, a script to write, a config to commit, a follow-up issue to file). If it's genuinely one-shot, say so.
- **Related** — links to the project plan, progress note, PR, or other issue this connects to.

Keep it short. The issue body should fit on one screen. If it doesn't fit, the task is probably two tasks.

## Related Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) -- PR workflow, changelog process, code conventions
- [AGENTS.md](AGENTS.md) -- universal AI agent entry point
- [docs/changelog/](docs/changelog/) -- monthly change history

## Monorepo Structure

- `apps/` - Application projects (djf.io, calendar-visualizer, ravrun)
- `docs/` - Project documentation and planning
- `.config/` - Shared configuration (mise, cspell)

## Tooling

- **Runtime**: Node 26, pnpm 10 (managed via mise)
- **Linting**: Biome, Oxlint
- **Formatting**: Biome (code); Prettier (Markdown/MDX only)
- **Type checking**: tsgo (`@typescript/native-preview`), per app
- **Spell Check**: cspell, shared config at `.config/cspell.json`. It's a single repo-wide gate — a root tool (mise `npm:cspell`), run via `mise run spell` and enforced on every push/PR by `ci-spell.yml`. Apps do not carry their own cspell dependency.
- **Per-app checks**: each app declares `typecheck` / `lint` / `format` / `test` / `build` as mise tasks in `apps/<name>/mise.toml` (`mise run check` runs them all); CI runs the same tasks
- **Rust** (aspirational, not yet wired): clippy (lint) + rustfmt (format), shared config
- **Full ownership map**: see [docs/tooling-standard.md](docs/tooling-standard.md) for which tool owns each concern per ecosystem

### Ecosystem tool choices

- **JS/TS package manager**: `bun` is preferred when a project does not also need a
  Node toolchain. `pnpm` is the accepted default for the Node ecosystem; `npm`
  projects should be converted unless there's a good reason. `yarn` is banned.
  (Open question: whether Cloudflare Wrangler works bun-only — until confirmed,
  Wrangler projects stay on pnpm.)
- **Lockfiles**: one per project. If a project has both `pnpm-lock.yaml` and
  `bun.lock`, keep `pnpm-lock.yaml` and delete `bun.lock`.
- **Python**: `uv`. `pip` is banned — never invoke it directly. `poetry` is banned.
- **Rust**: `cargo`.
- **Go**: `go mod`.
- **Tasks & scripts**: prefer `mise` tasks. If a task is too complex for a mise
  task, write it as a `bun` script. Scripts are written in `bun` — not a shell
  script — unless it is absolutely necessary. Scripts longer than a few lines go
  in a `bin/` directory, organized as makes sense; a `bin/` directory is not free
  rein to write bash, the bun-not-bash rule still applies inside it. Remove
  `justfile`s when found. Do not introduce new task tooling (moon, Taskfile, etc.)
  without an explicit ask.
- **Deployment**: Cloudflare. (Vercel has been dropped — remove references when
  encountered.) Pulumi / SST / Alchemy may come in later; not needed yet.

## File Naming

All directory and file names in the repo MUST use lowercase kebab-case. This applies to source files (`.ts`, `.tsx`, `.astro`), config files, docs, and scripts -- not just project documentation.

**Examples**: `vectorize-index.ts`, `chat-agent.ts`, `search-knowledge.ts`, `2026-05-16-progress.md`, `vite.config.ts`.

**Exceptions** (framework-imposed; do not change without intent):

- **React / Astro components**: `Header.tsx`, `BaseLayout.astro`, `ThemeToggle.tsx` -- PascalCase matches the component identifier and is the established convention in both ecosystems. Co-located tests follow the source name (e.g. `BaseLayout.test.ts`).
- **TanStack Router file-based routes**: `__root.tsx` and any other framework-mandated names.
- **Generated files**: e.g. `routeTree.gen.ts` from `@tanstack/router-plugin` -- leave as the tool emits them.

When in doubt, prefer kebab-case. If a third-party tool requires a different casing, treat that as the exception and document it here.

## Testing Conventions

- **Co-locate tests** with the file under test. Unit: `xxx.test.ts` next to `xxx.ts`. E2E: `xxx.e2e.test.ts` next to the source.
- **No `describe` blocks**. Flatten tests to top-level — see https://kentcdodds.com/blog/avoid-nesting-when-youre-testing. The user actively dislikes nested tests; do not add `describe` even for "grouping". If a test needs context, put it in the test name.
- **Avoid `beforeEach`/`beforeAll`/`afterEach`/`afterAll`** unless a framework requires it. Prefer top-level setup (top-level `await` for async), inline setup inside each test, or a small named helper called from each test. Hooks hide control flow and make tests harder to read.
- **For tests inside `src/pages/` (Astro routing constraint)**: prefix with `_` (e.g. `_index.e2e.test.ts`). Astro treats every `.ts` in `src/pages/` as an endpoint; the underscore is its built-in escape hatch. Outside `src/pages/`, no prefix.

### Runtime checks: smoke and e2e

Build-time checks (typecheck, lint, unit, build) can't catch an app that builds green but is broken at runtime (f311x shipped that way on 2026-06-11). Every **deployed** app gets a canonical runtime gate — a `smoke` mise task, or a Playwright e2e suite that subsumes it (`apps/djf.io`):

- **Contract**: `mise run smoke` (declares `depends = ["build"]`) boots the app's _production build_ locally and asserts the critical path serves — each key route returns 200 as a complete document whose hashed client assets also serve; an app with a backend also exercises it (f311x POSTs the chat endpoint and requires the echo stream). Deterministic and secret-free, so it runs on every PR.
- **Boot per stack** (reference scripts live in each app's `bin/smoke-local.ts`, bun): static Astro → `astro preview`; Vite SPA → `vite preview`; Cloudflare Worker / SSR → `wrangler dev` on the built worker (workerd), because `*-preview` only serves static assets. Spawn the preview **binary directly** (`node_modules/.bin/...`), not via `pnpm run` — killing the pnpm wrapper doesn't cascade to the server, so it outlives teardown and holds the port.
- **Knobs**: `SMOKE_*` env vars (URLs / routes / port) keep the same checks pointable at a local boot now and a per-PR preview deploy later.
- **CI**: a `smoke` job per deployed app, mirroring the `vitest` job.
- **e2e** (Playwright, `*.e2e.test.ts`) is the heavier browser-based layer for hydration / interaction / visual regression; optional per app, and a superset of smoke (see `apps/djf.io`).

### Coverage & the monorepo aggregator

- Apps with real unit-testable logic gate it with **vitest v8 coverage scoped to the logic** -- not UI / route / worker glue, which smoke + e2e cover. Set `coverage.include` to the tested modules (e.g. `src/lib/**`) and `coverage.thresholds` as a ratchet at / just under current, and run the unit task with `--coverage` so CI enforces it. f311x and djf.io are wired (100% on their logic); calendar-visualizer and forzamonica.com follow the same recipe. (Under Astro's `getViteConfig` the per-file `text` table renders empty -- cosmetic; `text-summary` and threshold enforcement work.)
- **`mise run test` / `mise run check` at the repo root** fan the task out to every app (`bin/run-app-tasks.ts`), for a one-command "verify the whole monorepo" -- complementing the per-app, path-filtered CI. They run each app with `CI=true` so pnpm's no-TTY deps-purge check can't abort.

## Apps

### djf.io (Personal Site)

- Location: `apps/djf.io`
- Stack: Astro, MDX, PandaCSS, React
- Content: Blog posts in `src/content/blog/`
