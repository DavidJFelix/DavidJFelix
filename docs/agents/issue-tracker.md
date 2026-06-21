# Issue tracker: hybrid (local markdown + GitHub)

Work in this repo is tracked in two places, by kind. Don't reach for one when the other is right.

## 1. Project work -- local markdown under `docs/projects/`

Plans and in-progress notes are committed markdown, not an external tracker:

- **Plan**: `docs/projects/<project-name>/plan.md` -- goal, rationale, phased plan, links.
- **Progress**: `docs/projects/<project-name>/YYYY-MM-DD-progress.md` -- one per working session.
- Index every active project in `docs/projects.md`.
- Directories are **working notes, not history**. When a project is done, capture it in
  `docs/changelog/` (monthly logs -- the durable record) and **delete the whole
  `docs/projects/<name>/` directory**, plus its entry in `docs/projects.md`.
- Naming: lowercase kebab-case for directories and files.

Full convention: `CLAUDE.md -> Project Documentation`.

## 2. Human-only tasks -- GitHub issues

When a task needs David's hands -- a credential, a DNS change, a third-party account decision, a
physical device, anything an agent can't do -- don't bury it in a progress note. Open a **GitHub
issue assigned to `@DavidJFelix`**.

Keep these issues **terse**: bullet steps, minimal prose, and **direct links to the exact thing to
act on** (the dashboard, the DNS provider, the account page). One verb per step; each step
independently checkable. Required shape (`CLAUDE.md -> Human Intervention Tasks`):

- **Background** -- 1-3 sentences: why a human, why now.
- **Steps** -- a `- [ ]` checklist. One verb each. Link straight to where the action happens.
- **Automation follow-up** -- how we avoid doing this by hand next time (a tool, a script, a config,
  a follow-up issue). If it's genuinely one-shot, say so.
- **Related** -- links to the project plan, progress note, PR, or other issue.

If it doesn't fit on one screen, it's probably two tasks.

### `gh` commands

- **Create**: `gh issue create --title "..." --body "..." --assignee DavidJFelix` (heredoc for
  multi-line bodies).
- **Read**: `gh issue view <number> --comments`.
- **List**:
  `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
  with `--label` / `--state` filters as needed.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

`gh` infers the repo (`DavidJFelix/DavidJFelix`) from `git remote` when run inside the clone.

## When a skill says "publish to the issue tracker"

- A plan or PRD for ongoing work -> write/update files under `docs/projects/<name>/` and index it in
  `docs/projects.md`.
- A discrete task that needs a human -> create a terse GitHub issue assigned to `@DavidJFelix`.

## When a skill says "fetch the relevant ticket"

- For project context -> read `docs/projects/<name>/plan.md` and the latest `*-progress.md`.
- For a GitHub issue -> `gh issue view <number> --comments`.

## Pull requests

**Not a request surface.** PRs here carry the repo's own in-flight changes; `/triage` does not pull
external PRs into a queue.
