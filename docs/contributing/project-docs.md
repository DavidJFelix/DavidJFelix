# Project Docs

How project documentation is structured. Plans and progress notes are committed markdown under
`docs/projects/`; the changelog is the durable record. For when to use a GitHub issue instead, see
[docs/agents/issue-tracker.md](../agents/issue-tracker.md).

## Directory structure

```
docs/
├── projects.md                          # Summary of all ongoing projects with links
└── projects/
    └── <project-name>/                  # Lowercase kebab-case project directory
        ├── plan.md                      # Project plan with goals, phases, and links
        └── YYYY-MM-DD-progress.md       # Progress notes (one per session)
```

## Project kinds

Two kinds of project live under `docs/projects/`:

- **App umbrella projects** -- one per app in `apps/` (e.g. `djf-io`, `onvibes-org`). These are
  _persistent_: an app's roadmap doesn't "complete," so its umbrella is a living document (vision,
  current state, roadmap). High-value efforts spin out from an umbrella as their own task projects
  or GitHub issues.
- **Task projects** -- focused and _ephemeral_ (e.g. a migration, a rollout). These follow the
  "Closing a project" rule below: when done, capture the result in `docs/changelog/` and delete the
  directory.

When the "working notes, not history / delete when complete" guidance below refers to projects, it
means **task projects**. App umbrellas persist.

## Naming

- **IMPERATIVE**: all project directories and files MUST use lowercase kebab-case naming
- Project directories: `blog-migration`, `api-refactor`, `design-system`
- Progress files: `2026-01-13-progress.md`, `2026-01-14-progress.md`
- Plan files: always named `plan.md`

## Creating a project

1. Create directory: `docs/projects/<project-name>/`
2. Create `plan.md` with:
   - Project goal and rationale
   - Phased implementation plan
   - Links to relevant files and resources
3. Create initial progress file: `YYYY-MM-DD-progress.md`
4. Add entry to `docs/projects.md` with link to plan

## Closing a project

Project directories are working notes, not history. When a project is complete:

1. Ensure the work is captured in `docs/changelog/`
2. Delete the entire `docs/projects/<project-name>/` directory
3. Remove the entry from `docs/projects.md`

The changelog is the durable record. `docs/projects.md` should reflect only active work.

## Progress file format

Each progress file should contain:

- Date and session summary
- Work completed
- Decisions made
- Next steps
- Any blockers or open questions
