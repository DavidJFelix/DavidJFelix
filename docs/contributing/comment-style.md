# Comment style

How comments and documentation are written -- when a comment earns its place, how it is worded, and
which code gets formal API docs. Code shape is [code-style.md](code-style.md); spelling is
[spelling.md](spelling.md); where the domain vocabulary lives is
[docs/agents/domain.md](../agents/domain.md). Review is automated: the `comment-review` Warden skill
(`.agents/skills/comment-review/`) runs on every PR and locally as `/comment-review`.

## The one test: would the code say it better?

A comment is the last resort for carrying meaning. Before writing one, try these in order and stop
at the first that works:

1. **Rename.** A comment that says what a variable, parameter, or function is describes a bad name.
   `const t = 300 // debounce delay in ms` is `const debounceDelayMs = 300`.
2. **Type it.** A comment that lists the valid values, states an invariant, or draws a conclusion
   ("when `owner` is null the item is a draft") is a type waiting to be written: a union, a
   discriminated union, a branded type, an object with named fields, a narrowing guard.
3. **Restructure.** A comment that labels a block of code ("validate the input", "build the query")
   is the name of a function the block should be extracted into. A comment that explains a condition
   is a named boolean: `if (user.role === 'admin' || user.id === item.ownerId)` becomes
   `if (canEditItem)`.
4. **Comment.** Only now, and only to say what the code cannot.

The comments that survive this ladder say one of four things:

- **Why**: a decision and the constraint or evidence behind it. "Sorted before dedupe: the API
  returns duplicates in arbitrary order."
- **An external fact**: a platform bug, a spec requirement, a vendor quirk -- with a link when one
  exists. "Node 20's undici lacks `markAsUncloneable`; see nodejs/undici#5024."
- **A warning**: a consequence of changing this code that the code cannot express. "This function is
  stringified into an inline script. It must not reference anything outside its own scope."
- **A contract**: the doc comment on a public API (see [API docs](#api-docs-public-surface-only)).

Never write a comment that narrates a control structure. "Loop over the users", "if the list is
empty, return early", "otherwise fall through" tell the reader what they can already read. If the
branch deserves a sentence, the sentence is a conclusion, and a conclusion belongs in a type or a
name before it belongs in prose.

## Succinct

- **One sentence is the default.** A second sentence carries the evidence or the link. A comment
  that needs a paragraph is either a design decision (write an ADR under `docs/adr/`) or module
  documentation (a README or the module's doc comment).
- **No throat-clearing.** Cut "Note that", "It should be noted", "Basically", "In order to", "This
  is used to", "The purpose of this is". Start with the fact.
- **No restating.** A comment that says the same thing as the line beneath it, in different words,
  is deleted. So is commented-out code -- git has it.
- **A `TODO` names an issue** (`TODO(#123): ...`) or is not written; an anonymous `TODO` is a
  comment nobody will act on.

## Simple language

Two registers, one principle: the reader should never have to decode the words to reach the idea.
This is the pattern of the `wait-what` skill (ASD-STE100 wording plus the repo's ubiquitous
language), applied at authoring time instead of after the fact.

**Comments are written in [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/).**
The rules that matter most for a comment:

- Short sentences: at most 20 words for an instruction, 25 for a description. One topic per
  sentence.
- Active voice, present tense: "the cache stores the token", not "the token is stored by the cache".
- One meaning per word, and the plain word over the formal one: "use" not "utilize", "before" not
  "prior to", "start" not "initiate", "if" not "in the event that", "do" not "perform".
- No idioms, no slang, no humour that a second-language reader would have to translate.
- Keep the articles; do not write telegraphic prose ("removes entry when stale" is "removes the
  entry when it is stale").
- At most three nouns in a row: "the deploy token for the preview worker", not "the preview worker
  deploy token".

The full rule digest with a word list lives beside the skill in
`.agents/skills/comment-review/references/simplified-technical-english.md`.

**Documentation is written in STE plus the ubiquitous language.** Markdown docs, READMEs, ADRs, and
the doc comments on public APIs name domain concepts with the terms their context glossary defines
(`CONTEXT.md`, reached through `CONTEXT-MAP.md`). A term the glossary says to avoid is a finding. A
term the glossary lacks is one of two things: a real gap, filled through `/domain-modeling`, or
invented language, fixed by using the term the project already has.

Identifiers are code, not vocabulary. A type, function, or variable that is defined in the file or
imported by name is referenced in backticks and never needs a glossary entry.

## Domain-driven, data-driven

Comments and docs describe the system in the domain's terms and along the flow of its data. Nouns
are glossary terms or identifiers; verbs are what the domain does to them.

- "Once payment clears, the `EnrollmentRequest` becomes an `Enrollment`" says what happens. "The
  handler processes the payload and updates the record" says nothing.
- **Named flows.** A data pipeline has a name for its input, each stage, and its output, and those
  names are the ones in the code. Docs walk the flow by those names; they do not introduce a
  parallel vocabulary.
- **A comment that names something the code lacks is the missing type or function.** If the prose
  needs a word for "the set of rows that survived the filter", the code needs that word too.

## API docs: public surface only

The exported surface of a **shared package** (`workspaces/web-apps/packages/*` -- anything an app
imports as a workspace dependency) and of any **published package** carries doc comments in the
language's standard doc format, so doc generators and editor hover pick them up:

| Language   | Format                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| TypeScript | [TSDoc](https://tsdoc.org/) `/** ... */` on each export                                             |
| Rust       | [rustdoc](https://doc.rust-lang.org/rustdoc/) `///` on items, `//!` at the crate or module root     |
| Python     | [PEP 257](https://peps.python.org/pep-0257/) docstrings                                             |
| Go         | [godoc](https://go.dev/doc/comment) comment beginning with the identifier's name                    |
| Elixir     | `@doc` attributes for [HexDocs](https://hexdocs.pm/)                                                |
| Other      | Whatever the language's doc generator reads; the `comment-review` skill's reference file lists more |

What a doc comment contains: one summary sentence in STE, then only what the signature cannot say --
units, invariants, the errors it raises, side effects, and an example when the call shape is not
obvious from the types. Not a parameter list that repeats the types, not "Returns the result".

**Nothing else gets doc-format comments.** App code, internal helpers, non-exported functions,
tests, and scripts use plain comments under the rules above, or none. An internal function that
seems to need a docstring needs a better name or a smaller surface.

When a human or an agent asks for doc-format comments on non-public code, push back. If the case is
real, amend this section with the edge case so the next reviewer knows it, rather than adding the
comment silently. Edge cases recognized so far:

- **Entry-point headers.** A script in `bin/`, a workflow, or a config file may open with a plain
  comment saying what it does and how it is invoked, because there is no signature to read. It is a
  regular comment, held to the rules above, not a doc comment.

## Review

Warden runs `comment-review` (`.agents/skills/comment-review/SKILL.md`) on every non-draft PR
alongside its built-in skills, and findings follow the sections of this guide. Run the same skill
locally as `/comment-review` before pushing. Its rules are this guide's; when the two disagree, fix
the guide first.

## References

- [code-style.md](code-style.md) -- naming, shape, and typing, the tools that make comments
  unnecessary
- [spelling.md](spelling.md) -- the unknown-word ladder
- [docs/agents/domain.md](../agents/domain.md) -- consuming `CONTEXT.md` glossaries and ADRs
- [ASD-STE100](https://www.asd-ste100.org/) -- the specification, free on request
