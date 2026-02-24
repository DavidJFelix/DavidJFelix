# Changelog

Change history for the monorepo, organized as monthly files in reverse chronological order.

## Format

Each file is named `YYYY-MM.md` and contains entries grouped by date. Entries use [conventional commit](https://www.conventionalcommits.org/) categories.

```markdown
## YYYY-MM-DD

### type(scope): short description

Context about what changed and why.
```

### Types

- `feat` -- new feature or capability
- `fix` -- bug fix
- `refactor` -- code restructuring without behavior change
- `docs` -- documentation only
- `chore` -- tooling, config, dependencies
- `test` -- adding or updating tests

### Scopes

Use the app or area name: `djf.io`, `calendar-visualizer`, `ravrun`, `tooling`, `docs`, `repo`.

## Per-app changelogs

Published packages may maintain their own `CHANGELOG.md` at `apps/<name>/CHANGELOG.md` for release-specific history. This directory captures repo-wide changes across all apps and infrastructure.

## Files

- [2026-02.md](./2026-02.md)
