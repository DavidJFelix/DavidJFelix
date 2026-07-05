# Contributing

This document is primarily for AI agents (Claude Code, GitHub Copilot) that operate on this
repository. Human contributors should also follow these conventions. Repo orientation and the hard
rules live in [AGENTS.md](AGENTS.md); the detailed style guides live in
[docs/contributing/](docs/contributing/) and are indexed below.

## PR workflow

1. Create a feature branch
2. Make changes following the style guides below
3. Open a PR with a [conventional commit](https://www.conventionalcommits.org/) title
4. Add a changelog fragment to `docs/changelog/fragments/` (never edit `docs/changelog/YYYY-MM.md`
   directly)
5. If you touched `.config/mise.toml`, run `mise install` and commit the resulting
   `.config/mise.lock` change in the same PR -- CI fails on a stale lockfile (see
   [tooling-standard.md](docs/contributing/tooling-standard.md))

### PR title format

```
type(scope): description
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

**Scopes:** the app name (`djf.io`, `calendar-visualizer`, `ravrun`, ...), `tooling`, `docs`, or
`repo`

### Changelog

Add one fragment file to `docs/changelog/fragments/`, named
`YYYY-MM-DD-<type>-<scope>-<short-slug>.md` (lowercase kebab-case; dots in scopes flatten, so
`djf.io` becomes `djf-io`). The body is exactly one entry in the monthly-file format: a
`### type(scope): description` heading followed by the prose paragraphs.

Never edit the monthly `docs/changelog/YYYY-MM.md` files -- they are only ever written by the
roll-up (`mise run changelog:rollup`), which the `cron-changelog-rollup` workflow runs weekly,
opening a PR with the result. Fragments from parallel PRs merge without conflicts because each PR
adds its own file. See [docs/changelog/README.md](docs/changelog/README.md) for format details.

## Style guides

One mini guide per concern, in `docs/contributing/`. Read the guide before working in its area;
[AGENTS.md](AGENTS.md#hard-rules) carries the one-line versions.

| Guide                                                                | Owns                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| [code-style.md](docs/contributing/code-style.md)                     | formatting defaults, functional shape, named arguments |
| [file-naming.md](docs/contributing/file-naming.md)                   | kebab-case rule and the framework-imposed exceptions   |
| [testing.md](docs/contributing/testing.md)                           | test style, smoke/e2e runtime gates, coverage ratchets |
| [linting.md](docs/contributing/linting.md)                           | fix findings, don't silence them                       |
| [configuration-style.md](docs/contributing/configuration-style.md)   | config file placement, scoping, and format             |
| [scripting-style.md](docs/contributing/scripting-style.md)           | language order, bun scripts, the sed/perl ban          |
| [tooling-standard.md](docs/contributing/tooling-standard.md)         | tool ownership per concern, ecosystem defaults         |
| [github-actions-style.md](docs/contributing/github-actions-style.md) | workflow naming, paths filters, parallelism            |
| [project-docs.md](docs/contributing/project-docs.md)                 | project plans, progress notes, lifecycle               |

## GitHub Actions

Workflows live in `.depot/workflows/` (GitHub Actions syntax, run on Depot CI). Follow
[github-actions-style.md](docs/contributing/github-actions-style.md) -- including its new-workflow
checklist -- whenever you add or touch one.

## Code review

[Warden](https://warden.sentry.dev/guide) is the canonical automated reviewer: it runs its built-in
`security-review` and `code-review` skills on demand -- add the `Warden` label to a PR
(`.depot/workflows/ci-warden.yml`) -- and owns the inline findings posted to the PR. Everything else
complements it -- nothing else should post competing PR comments. The
[review-consolidation](docs/projects/review-consolidation/plan.md) project tracks the direction
(Warden is the path forward; other tools complement, not compete).

- **Warden (CI gate, label-gated).** Add the `Warden` label to a PR (drafts included) to review its
  current head; remove and re-add the label to re-run. It is the single source of posted inline
  review comments, and findings at `failOn` severity fail the check. Also runs locally:
  `mise exec -- warden <ref>` with `WARDEN_MODEL` and `WARDEN_OPENROUTER_API_KEY` exported.
- **Built-in `/code-review` and `/security-review` (local).** Run on-demand before you push, as an
  inner-loop sanity pass. Do **not** pass `--comment` -- Warden owns posted comments, and
  double-posting the same diff is noise and double model spend.
- **`/review` (Standards + Spec).** The holistic on-demand review: does the branch follow the repo's
  documented standards, and does it match the originating issue/PRD? Warden checks neither, so this
  stays.

## Project lifecycle

Project directories under `docs/projects/<name>/` are working notes, not history. When a project
completes, capture it in `docs/changelog/` and delete the directory. Full rules in
[project-docs.md](docs/contributing/project-docs.md); when a task needs a human instead, file a
GitHub issue per [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
