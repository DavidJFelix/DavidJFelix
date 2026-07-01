# Agents

Entry point for AI coding agents operating on this repository. Start here; everything else is
linked from this file.

## Repository overview

Personal monorepo containing web applications, exercises, and configuration. No pnpm workspace --
apps have independent lockfiles and dependencies. Shared dev tooling is managed via mise
(`.config/mise.toml`).

## Key paths

| Path                 | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `apps/`              | Application projects, one directory per app; [docs/projects.md](docs/projects.md) describes each |
| `docs/contributing/` | Style mini guides -- naming, testing, linting, config, scripting, tooling, CI, project docs |
| `docs/agents/`       | Agent workflow docs -- issue tracker, triage labels, domain docs                            |
| `docs/projects/`     | Active project plans and progress notes (ephemeral working notes)                           |
| `docs/changelog/`    | Monthly change history (the durable record)                                                 |
| `.agents/agents/`    | Review personas -- focused reviewer subagents (solid copies)                                |
| `.agents/skills/`    | Claude Code skills (solid copies)                                                           |
| `.config/`           | Shared tooling config (mise, cspell)                                                        |
| `bin/`               | Repo-root bun scripts, fronted by mise tasks                                                |

`.agents/` is the tool-agnostic source of truth for skills and personas; `.claude/skills/` and
`.claude/agents/` hold tracked symlinks into it, because Claude Code only discovers `.claude/`.
When adding a skill or persona, put the solid copy in `.agents/` and symlink it from `.claude/`
(one symlink per skill folder / agent file -- never symlink the whole directory).

## Hard rules

The non-negotiable rules, one line each. Follow the link before working in that area.

- **Naming**: lowercase kebab-case for every file and directory; framework-imposed exceptions only
  -- [file-naming.md](docs/contributing/file-naming.md)
- **No emojis** in code, commits, or documentation
- **Commits/PRs**: [conventional commit](https://www.conventionalcommits.org/) PR titles; every PR
  adds a changelog entry -- [CONTRIBUTING.md](CONTRIBUTING.md)
- **Testing**: co-located tests, no `describe` blocks, no lifecycle hooks; deployed apps carry a
  smoke gate -- [testing.md](docs/contributing/testing.md)
- **Scripts**: mise task first, then a bun script in `bin/`; bash only when trivial; `sed` and
  `perl` are banned everywhere, CI included --
  [scripting-style.md](docs/contributing/scripting-style.md)
- **Packages**: pnpm (or bun where no Node toolchain is needed); `yarn` banned; `uv`, never `pip`;
  one lockfile per project -- [tooling-standard.md](docs/contributing/tooling-standard.md)
- **Config**: prefer `.config/`; real-language config over JSONC over TOML over JSON over YAML --
  [configuration-style.md](docs/contributing/configuration-style.md)
- **Lint findings**: fix them; never disable rules or exclude files to dodge one --
  [linting.md](docs/contributing/linting.md)
- **Project docs are ephemeral**: plans and progress live in `docs/projects/<name>/`; when done,
  capture in the changelog and delete -- [project-docs.md](docs/contributing/project-docs.md)
- **Deployment**: Cloudflare. Vercel has been dropped -- remove references when encountered

## Where things are documented

- [CONTRIBUTING.md](CONTRIBUTING.md) -- PR workflow, changelog process, index of the style guides
- [docs/contributing/](docs/contributing/) -- the style mini guides themselves
- [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) -- hybrid tracker: markdown project
  docs plus terse GitHub issues for human-only tasks
- [docs/agents/triage-labels.md](docs/agents/triage-labels.md) -- canonical GitHub issue labels
- [docs/agents/domain.md](docs/agents/domain.md) -- how to consume `CONTEXT.md` glossaries and ADRs
- [CONTEXT-MAP.md](CONTEXT-MAP.md) -- per-app domain contexts and ADR locations
- [docs/projects.md](docs/projects.md) -- active project index (also the app portfolio map)
- [docs/changelog/](docs/changelog/) -- monthly change history

## Review personas

Six focused reviewers live in `.agents/agents/`. Each answers one question and reports only
findings that would change a decision -- "just enough" applies to reviews too. Run the relevant
ones together with the `/panel-review` skill, or invoke one directly as a subagent.

| Persona                | Question                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `design-reviewer`      | Does this look good -- consistent, calm, free of noise?     |
| `product-reviewer`     | Does this meet the desire just enough, with no extras?      |
| `engineering-reviewer` | Is this well organized, right-sized, and easy to work in?   |
| `testing-reviewer`     | Do the tests prove it works and will not regress?           |
| `benchmark-reviewer`   | Is there a numeric goal, and can we measure against it?     |
| `tooling-reviewer`     | Does this reduce friction in the development loop?          |

## Sub-folder agent docs

Folders may define their own `AGENTS.md` when they need additional context or instructions beyond
what this top-level file provides. They are optional -- add one only when a folder has guidance
worth documenting.

- [apps/calendar-visualizer/AGENTS.md](apps/calendar-visualizer/AGENTS.md)
