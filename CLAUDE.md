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
- **Formatting**: Biome
- **Spell Check**: cspell with shared config at `.config/cspell.json`

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

## Apps

### djf.io (Personal Site)

- Location: `apps/djf.io`
- Stack: Astro, MDX, PandaCSS, React
- Content: Blog posts in `src/content/docs/blog/`
