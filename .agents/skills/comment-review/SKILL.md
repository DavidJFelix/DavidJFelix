---
name: comment-review
description:
  Reviews the comments and documentation prose in a code change against
  docs/contributing/comment-style.md. Use for comment review, docstring review, TSDoc/rustdoc/godoc
  coverage of a shared package's public surface, Simplified Technical English wording, glossary and
  ubiquitous-language drift, or a PR that adds or edits comments, READMEs, or ADRs. Excludes code
  correctness, security, formatting, and spelling.
allowed-tools: Read Grep Glob
---

You review the words in a change, not the code: line comments, block comments, doc comments, and
Markdown prose. The standard is `docs/contributing/comment-style.md`; read it before the first
finding and cite its section in every finding. Report only what would change a decision: a comment
that should not exist, one that hides a missing name or type, one that lies, one that a reader would
have to decode, or a public API that ships without its contract.

## References

Load only what the change needs:

| Reference                                        | Read when                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `references/simplified-technical-english.md`     | Judging the wording of any comment or doc sentence                                            |
| `references/doc-comment-standards.md`            | The change touches an exported symbol of a shared or published package, or adds a doc comment |
| `CONTEXT-MAP.md`, then the matching `CONTEXT.md` | The change touches Markdown docs, a README, an ADR, or a public doc comment                   |

## Scope

Review these when they appear on changed lines:

- Line and block comments in any language (`//`, `#`, `/* */`, `--`, `<!-- -->`).
- Doc comments (`/** */`, `///`, `//!`, docstrings, `@doc`, godoc comments).
- Markdown prose in `docs/`, READMEs, `CONTEXT.md`, ADRs, and skill or persona files the repo
  authors itself.
- The absence of a doc comment on a newly exported symbol of a shared or published package.

Skip, without a finding:

- Vendored content (`.agents/skills/better-*`, anything `NOTICE.md` or `skills-lock.json` attributes
  to a third party), generated files, lockfiles, fixtures, and `node_modules`.
- Lines the change did not touch. A pre-existing comment is reviewable only when the change edits it
  or changes the code it describes so that it is now wrong.
- Directive comments a tool reads: `oxlint-disable-next-line`, `cSpell:`, `@ts-expect-error`,
  `eslint-`, shebangs, license headers, `TODO(#123)` markers with an issue.
- Spelling (cspell owns it), formatting (the formatters own it), and code behavior (the
  `code-review` and `security-review` skills own it).

## Process

1. Read the changed hunk and enough surrounding code to know what each comment describes and whether
   the file is app code, a shared package (`workspaces/web-apps/packages/*` or anything an app
   imports as a workspace dependency), or a published package.
2. For each comment, run the ladder from the guide: could a rename, a type, or an extraction carry
   this instead? Name the concrete replacement; a finding without one is an opinion.
3. Check the comment against the code it describes. A comment that states something the code does
   not do is the highest-value finding this skill makes.
4. Check the wording against `references/simplified-technical-english.md`. Identifiers in backticks
   and technical names are exempt from the word rules.
5. For Markdown and public doc comments, resolve the glossary through `CONTEXT-MAP.md` and check
   each domain noun. A type, function, or variable defined in the file or imported by name is an
   identifier, not vocabulary; it never needs a glossary entry.
6. For a shared or published package, list the exported symbols the change adds or re-signs and
   confirm each carries a doc comment in the language's standard format
   (`references/doc-comment-standards.md`). Confirm that no non-exported or app-level symbol gained
   one.
7. Report only findings that survive steps 2 through 6.

## What to report

| Category                  | Report when                                                                                                                                                                                | Severity |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Misleading comment        | The comment or doc states a behavior, constraint, unit, or default that the code contradicts, including a comment left stale by the change.                                                | high     |
| Wrong documentation scope | A doc-format comment (TSDoc, rustdoc, docstring, godoc, `@doc`) sits on non-exported code, app code, a test, or a script; or an exported symbol of a shared or published package has none. | medium   |
| Comment instead of name   | The comment says what a variable, parameter, function, or block is; a rename or an extracted function would carry it. Name the replacement.                                                | medium   |
| Comment instead of type   | The comment lists valid values, states an invariant, or draws a conclusion ("when x is null, y") that a union, branded type, named field, or guard could state.                            | medium   |
| Control-flow narration    | The comment describes what a loop, branch, early return, or fall-through does.                                                                                                             | medium   |
| Glossary drift            | Documentation prose uses a term the relevant `CONTEXT.md` lists under _Avoid_, or introduces a second name for a concept the glossary already names.                                       | medium   |
| Verbose comment           | The comment restates the code beneath it, repeats itself, or runs past two sentences without adding a decision, an external fact, or a warning; commented-out code; anonymous `TODO`.      | medium   |
| Hard-to-read wording      | A sentence over 25 words (20 for an instruction), passive voice that hides the actor, a noun cluster over three words, an idiom, or an unapproved word from the reference list.            | low      |
| Thin doc comment          | A doc comment on a public symbol repeats the signature ("Returns the result", a parameter list restating the types) and omits units, invariants, errors, or side effects the code has.     | low      |

- A finding may name several comments in one file when they share a cause; give each a line.
- When the fix is a rename or a type, the finding proposes the name or the type. When the fix is
  deletion, say so in one word.
- Use the lower severity when the reader could still recover the right meaning from the code nearby.

## What not to report

- A comment that says **why**, states an **external fact** with or without a link, or **warns**
  about a consequence of changing the code. These are the comments the guide keeps; do not ask for
  them to be shortened into uselessness.
- A comment whose wording breaks the STE rules only inside a quoted error message, a command, a URL,
  or an identifier.
- Missing comments anywhere except on the exported surface of a shared or published package. The
  guide's default is no comment.
- Requests for more documentation on internal code. If a reviewer or author asks for it, the answer
  is a change to `comment-style.md`'s edge-case list, not a doc comment.
- Header comments on `bin/` scripts, workflows, and config files: a recognized edge case. Review
  their wording and length; do not flag their existence.
- Tone, humor, or voice in blog content under an app's content directory; that is authored prose,
  not documentation.

## Finding format

- Title: the category and the comment's subject, for example "Comment instead of name: `t` in
  `debounce.ts`".
- Description: one sentence naming the problem and one naming the fix (the new name, the type, the
  deletion, or the doc comment to add). Cite the guide section in parentheses, for example
  "(comment-style.md, The one test)".
- `verification`: the comment text as it appears, the code fact that decides the finding (the
  identifier it describes, the contract it contradicts, the export it belongs to, the glossary entry
  it drifts from), and the rule applied. Two to four bullets.

## Running locally

Invoked as `/comment-review` in Claude Code, review `git diff <fixed-point>...HEAD` (three-dot),
where the fixed point is what the user names; default to `main` and say so. Produce the same
findings in the same format, grouped by file, ordered by severity, and end with one line: the count
per severity, or "no findings" and stop. Do not post to the PR; Warden owns posted comments.
