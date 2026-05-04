# Contributing

This document is primarily for AI agents (Claude Code, GitHub Copilot) that operate on this repository. Human contributors should also follow these conventions.

## PR workflow

1. Create a feature branch
2. Make changes following the conventions below
3. Open a PR with a [conventional commit](https://www.conventionalcommits.org/) title
4. Add a changelog entry to `docs/changelog/YYYY-MM.md`

### PR title format

```
type(scope): description
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

**Scopes:** `djf.io`, `calendar-visualizer`, `ravrun`, `tooling`, `docs`, `repo`

### Changelog

Add an entry to the current month's file in `docs/changelog/`. Create the monthly file if it does not exist yet. Months with no changes are skipped entirely -- do not create empty files. See [docs/changelog/README.md](docs/changelog/README.md) for format details.

## Code conventions

- No emojis in code, commits, or documentation
- Follow existing patterns in the codebase
- Use tooling defined in `.config/mise.toml` (Biome, Oxlint, Prettier)
- See per-app `package.json` scripts for lint/format/spell commands

## Project lifecycle

Project directories under `docs/projects/<name>/` are working notes -- plan, progress, open questions. They exist to coordinate work in flight, not to serve as history.

When a project is complete:

1. Ensure the work is captured in `docs/changelog/`
2. Delete the entire `docs/projects/<name>/` directory
3. Remove the entry from `docs/projects.md`

The changelog is the durable record. Do not retain finished project directories with a "Complete" status -- `docs/projects.md` should reflect only active work.

## Documentation conventions

All project documentation follows the structure defined in [CLAUDE.md](CLAUDE.md):
- Project plans and progress in `docs/projects/<project-name>/`
- Lowercase kebab-case naming for all doc directories and files
- Progress files named `YYYY-MM-DD-progress.md`

## References

- [CLAUDE.md](CLAUDE.md) -- project documentation standards, monorepo structure, tooling
- [AGENTS.md](AGENTS.md) -- AI agent entry point with repo overview
- [docs/changelog/](docs/changelog/) -- change history
- [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) -- PR template
