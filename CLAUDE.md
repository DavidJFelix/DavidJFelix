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

### Progress File Format

Each progress file should contain:
- Date and session summary
- Work completed
- Decisions made
- Next steps
- Any blockers or open questions

## Related Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) -- PR workflow, changelog process, code conventions
- [AGENTS.md](AGENTS.md) -- universal AI agent entry point
- [docs/changelog/](docs/changelog/) -- monthly change history

## Monorepo Structure

- `apps/` - Application projects (djf.io, calendar-visualizer, ravrun)
- `docs/` - Project documentation and planning
- `.config/` - Shared configuration (mise, cspell)

## Tooling

- **Runtime**: Node 22, pnpm 10 (managed via mise)
- **Linting**: Biome, Oxlint
- **Formatting**: Biome
- **Spell Check**: cspell with shared config at `.config/cspell.json`

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
