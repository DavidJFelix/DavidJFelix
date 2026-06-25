# Scripting style guide

When you need to automate something -- a build step, a one-off, CI glue, a codemod -- which language
do you reach for, and which do you refuse? This guide ranks the choices and bans two.

It expands on the "Tasks & scripts" rule in [CLAUDE.md](../CLAUDE.md): prefer a `mise` task; if a task
is too complex for one, write a script. The first question is always **can this be a `mise` task
calling an existing tool?** If so, do that and stop. Everything below is for when you genuinely need
to write a script.

## Language preference order

| Rank | Language                     | When                                                          |
| ---- | ---------------------------- | ------------------------------------------------------------- |
| 1    | The project's native language | A script inside a project, written in that project's language |
| 2    | Bun / TypeScript             | The default for this monorepo's repo- and app-level scripts   |
| 3    | Python (pinned + uv)         | When Python is the better fit -- ML ops, Python-tied tooling |
| 4    | Bash                         | Bootstrap before a runtime exists, or a trivial few-liner     |
| 5    | Interactive shells           | Nushell / Fish / Zsh -- **never** for committed scripts       |

### 1. The project's native language

A script that lives inside a project is written in that project's primary language. A Rust crate's
helper is a `cargo` bin or `xtask`; an Elixir app's task is a `Mix.Task`; a Go module's tool is a
`go run` program. The toolchain, types, and dependencies are already there, contributors already know
the language, and the script can import the project's own code.

In this monorepo the native language is overwhelmingly TypeScript, so for repo-level and app-level
scripts rank 1 and rank 2 collapse into the same answer: **Bun + TypeScript.**

### 2. Bun / TypeScript (the monorepo default)

This matches the repo rule that scripts are bun, not bash (declared in `.config/mise.toml`).

- **Shebang `#!/usr/bin/env bun`.** ESM only -- `import`, top-level `await`. Never `require` (see
  [configuration-style.md](configuration-style.md#4-javascript--typescript-config-typescript--esm)).
- **Live in a `bin/` directory** -- `bin/` at the repo root for repo-wide scripts,
  `apps/<name>/bin/` for app-scoped ones. Reference examples: `bin/run-app-tasks.ts`,
  `bin/smoke-url.ts`.
- **Entry point is a `mise` task** that calls the script, so nobody has to remember the path
  (`run = "bun bin/run-app-tasks.ts test"`).
- **Use Bun's built-ins** instead of shelling out: `Bun.spawn`, `Bun.file`, `fetch`, `Bun.sleep`, and
  the `$` shell tag (`import {$} from 'bun'`) for shell-like pipelines. The `$` tag is the answer to
  "but I need to pipe commands" -- you get shell ergonomics with real escaping, types, and error
  handling, without leaving TypeScript:

  ```ts
  import {$} from 'bun'
  const branch = await $`git rev-parse --abbrev-ref HEAD`.text()
  ```

- **Co-locate tests** (`xxx.test.ts`) and run them with `bun test` -- a script with real logic gets a
  test, same as any other code (`bin/upload-preview.test.ts`).

### 3. Python (pinned version + uv)

Bun and TypeScript cover the overwhelming majority of scripting -- reach for Python only when it is
the clearly better fit, not merely possible. Bun is usually enough; Python becomes the obvious choice
when the work is closely tied to its ecosystem -- ML ops, data/ML libraries, a Python-native tool, or
Starlark-adjacent build config. When Python is the right call, use it -- and only ever with **uv**.
`pip` and `poetry` are banned (per CLAUDE.md); never invoke `pip` directly.

**Pin the Python version explicitly -- never float.** Choose an explicit, repo-approved version and
pin it; don't track "latest." Two mechanisms:

- **Single-file scripts:** PEP 723 inline metadata, run with `uv run`. uv fetches the exact
  interpreter and dependencies into an ephemeral environment:

  ```python
  #!/usr/bin/env -S uv run --script
  # /// script
  # requires-python = ">=3.13"  # compatibility floor; uv pins the exact interpreter
  # dependencies = ["httpx"]
  # ///
  ```

- **Project scripts:** a `.python-version` file (pins the interpreter) plus `requires-python` in
  `pyproject.toml` and a committed `uv.lock`.

### 4. Bash

Bash is the fallback for exactly two cases: **bootstrap/provisioning before a real runtime exists**
(the moment before bun or uv is installed -- see `dotfiles/scripts/`), or a **genuinely trivial
few-liner** that a real runtime would only complicate. Constraints:

- **Keep it small.** The moment it grows logic -- loops that parse command output, conditionals on
  structured data, arrays of records -- promote it to a Bun script. Bash has no types, no real error
  handling, quoting footguns, and no test story; the `$` shell tag gives the same orchestration with
  none of that.
- `#!/usr/bin/env bash` and `set -euo pipefail`. Keep it shellcheck-clean.
- **Bash orchestrates other programs; it does not transform text.** No `sed` or `perl` reach-for
  (see the ban below).

### 5. Interactive shells -- Nushell, Fish, Zsh (never committed)

Nushell, Fish, and Zsh are for the human at the prompt, not for committed automation. They are
configured per-user (the dotfiles ship a Fish config under `dotfiles/.config/fish/`), they are not
guaranteed present on CI runners or other machines, and their syntax is not portable.

- **Do not commit `.fish` / `.nu` / `.zsh` scripts as project automation.** They are fine as personal
  dotfiles and aliases -- that is what `dotfiles/.config/fish/` is for.
- If you want Nushell's structured-data ergonomics in automation, that is a sign the task wants
  Bun + TypeScript (structured data, types) -- write it there.

## Banned: `sed` and `perl` (everywhere)

Never write `sed` or `perl` -- not in `bin/`, not inline in a bash script, not in a GitHub Actions
`run:` step, not in any programmatic workflow or codemod. **This ban is absolute and includes CI.**

Why: they are write-only (an unreadable, unreviewable one-liner that is silently wrong on edge cases
-- multiline, escaping, encoding), untestable, and unportable (BSD vs GNU `sed` differ). Every job
people reach for them has a safer, testable home:

| Instead of...                               | Use...                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `sed -i 's/x/y/' file` (find/replace)       | a Bun script: `Bun.file(path)` -> `.text()` -> `.replaceAll` -> `Bun.write` |
| `sed` / `perl` editing JSON                 | `JSON.parse` -> mutate -> re-serialize in Bun                           |
| `perl -pe` / `sed` editing YAML             | a YAML library in Bun (or `yq` if a binary is genuinely required)       |
| `sed -n '5,10p'` (slice lines)              | `(await Bun.file(path).text()).split('\n').slice(4, 10)`                |
| extracting a regex match in a CI step       | a Bun one-liner (`bun -e '...'`) or a `bin/*.ts` script                 |

**GitHub Actions specifically:** a workflow step that needs to transform text calls a `bin/*.ts`
script (`run: bun bin/foo.ts`) rather than inlining `sed`/`perl`. The logic stays reviewable,
testable, and identical locally and in CI. Name the step after the tool it runs, per
[github-actions-style.md](github-actions-style.md#step-naming-name-each-step-after-the-tool-it-runs).

## Where scripts live and how they run

- Repo-wide scripts: `bin/*.ts` at the repo root. App-scoped scripts: `apps/<name>/bin/*.ts`.
- The entry point is a `mise` task that calls the script -- don't make humans remember script paths.
- **Do not introduce new task runners** (just, make, Taskfile, moon). `mise` owns task orchestration;
  remove `justfile`s when found (per CLAUDE.md).

## Checklist for a new script

- [ ] Could this just be a `mise` task calling an existing tool? If so, do that instead.
- [ ] Written in the project's native language (Bun / TypeScript in this monorepo)?
- [ ] ESM, `#!/usr/bin/env bun`, lives in a `bin/` directory?
- [ ] **No `sed`, no `perl`**, no inline bash text-munging -- in scripts _or_ workflow `run:` steps?
- [ ] Python? uv + an explicitly pinned version (PEP 723 or `.python-version`), never `pip`/`poetry`?
- [ ] Bash? Only because there's no runtime yet or it's trivial; `set -euo pipefail`; no text
      transformation?
- [ ] Not a committed `.fish` / `.nu` / `.zsh` script?
- [ ] Has a co-located `*.test.ts` if it carries real logic?

## References

- [configuration-style.md](configuration-style.md) -- where config files live and what format
- [github-actions-style.md](github-actions-style.md) -- workflow conventions
- [CLAUDE.md](../CLAUDE.md) -- the "Tasks & scripts" and ecosystem tool-choice rules
- [CONTRIBUTING.md](../CONTRIBUTING.md) -- PR workflow and code conventions
