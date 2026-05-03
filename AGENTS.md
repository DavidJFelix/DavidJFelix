# Agents

Entry point for AI coding agents operating on this repository.

## Repository overview

Personal monorepo containing web applications, exercises, and configuration. No pnpm workspace -- apps have independent lockfiles and dependencies. Shared dev tooling is managed via mise.

## Key paths

| Path | Description |
|------|-------------|
| `apps/djf.io/` | Personal site (Astro, MDX, PandaCSS, React) |
| `apps/calendar-visualizer/` | Calendar visualization app (Astro, PandaCSS, React) |
| `apps/ravrun/` | Web app (Vite, TanStack Router, React) |
| `docs/` | Project documentation and changelog |
| `.config/` | Shared tooling config (mise, cspell) |

## Conventions

- **Commits/PRs:** [Conventional commits](https://www.conventionalcommits.org/) for PR titles
- **Naming:** Lowercase kebab-case for all directories and documentation files
- **No emojis** in code, commits, or documentation
- **Tooling:** Biome (JS/TS/CSS/JSON), Oxlint, Prettier (MD/MDX only), cspell

## References

- [CLAUDE.md](CLAUDE.md) -- Claude Code-specific guidelines, documentation standards, app details
- [CONTRIBUTING.md](CONTRIBUTING.md) -- PR workflow, changelog process, code conventions
- [docs/changelog/](docs/changelog/) -- monthly change history
- [docs/projects.md](docs/projects.md) -- active project index

## Sub-folder agent docs

Folders may define their own `AGENTS.md` when they need additional context or instructions beyond what this top-level file provides. They are optional -- add one only when a folder has guidance worth documenting.

- [apps/calendar-visualizer/AGENTS.md](apps/calendar-visualizer/AGENTS.md)
