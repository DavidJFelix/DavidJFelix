# Changelog

Change history for the monorepo, organized as monthly files in reverse chronological order.

## Fragments

Changes enter the changelog as fragment files in [fragments/](./fragments/), one per PR -- parallel
PRs never conflict because each adds its own file. A fragment is named
`YYYY-MM-DD-<type>-<scope>-<short-slug>.md` and contains exactly one entry in the format below
(heading plus prose). See [fragments/README.md](./fragments/README.md) for the full rules.

The monthly files are only ever written by the roll-up -- never edit them directly.
`mise run changelog:rollup` folds every pending fragment into the right `YYYY-MM.md` (creating the
month file or day heading as needed, days newest-first, filename order within a day), deletes the
folded fragments, and refreshes the file list at the bottom of this README. The
`cron-changelog-rollup` workflow runs it weekly and opens a PR with the result; run the task
manually for an immediate roll-up.

## Format

Each file is named `YYYY-MM.md` and contains entries grouped by date. Entries use
[conventional commit](https://www.conventionalcommits.org/) categories.

Months with no changes are skipped -- do not create an empty file. Gaps in the file list are
expected and intentional.

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

Published packages may maintain their own `CHANGELOG.md` at `apps/<name>/CHANGELOG.md` for
release-specific history. This directory captures repo-wide changes across all apps and
infrastructure.

## Files

- [2026-07.md](./2026-07.md)
- [2026-06.md](./2026-06.md)
- [2026-05.md](./2026-05.md)
- [2026-04.md](./2026-04.md)
- [2026-02.md](./2026-02.md)
