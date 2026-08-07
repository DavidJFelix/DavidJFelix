### feat(revision.city): report a config diff once per change, not once per shifted sibling

The Symbols tab reported PR #409's three-edit `.config/cspell.jsonc` change as 21 rows. Sibling
entities that share a name -- the `name`/`path` keys that every object in a JSON array carries --
were disambiguated with document-order ordinals (`name#2`), and the matcher trusted that ordinal as
identity. One array insertion shifted every later sibling's ordinal and cascaded into fifteen bogus
`modified` rows, with the `added` rows attached to the wrong object entirely. Scalar arrays like
`words` were just as unhelpful in the other direction: one bare `modified` with no hint of what
changed.

Three changes to the engine, designed against sem/difftastic/diffsitter's shared insight that
sibling sequences must be aligned by content, not labeled by position:

- **Occurrence alignment.** The matcher's first phase now groups entities by kind plus base path
  (ordinals stripped) and aligns each group's occurrence sequences: content-identical occurrences
  pair by LCS however far they shifted, leftovers zip in order as in-place edits, and only true
  extras fall through as added or deleted. Language-agnostic, so repeated markdown headings and
  function overloads stop cascading too.
- **Sequence detail.** A JSON array property carries per-element fingerprints (hash, preview, line
  range), and a modified pair diffs them element-wise -- common ends stripped, LCS on the middle --
  attaching `167 -> 169, "ciphertext" inserted at index 9` to the row. The viewer renders each edit
  as an indented, clickable line under its key, capped behind an "and n more" count.
- **Rollup.** Entity rows sitting wholly inside an element the sequence diff already reported
  inserted or deleted are suppressed, checked by source offsets plus path prefix, before the rename
  phases could pair them with something unrelated. An inserted object is one line, not one line plus
  a row per key inside it.

Replayed against the real PR #409 revisions, the cspell.jsonc report drops from 21 rows to exactly
three -- one per changed array, each carrying sizes and insertion indexes. Elements stay
fingerprints rather than entities, so the per-file entity budget and the wire format are untouched
(`detail` is an additive optional field). Design notes and the validation trail live in
`docs/projects/revision-city/2026-08-06-progress.md`.

Dogfooding this PR's own Symbols tab surfaced a second leak: `top-level` scoping was enforced
against the entity frame stack, and an arrow passed to `test()` never becomes a frame, so the consts
inside it read as module constants -- six spurious added rows on one test file. A new
`anonymousScopeProp` marks closure node types (JS/TS arrows and function expressions, Go function
literals, Rust closures, PHP closures) so the walker counts them as executable scope even when no
entity encloses them. And because a test file's real semantic change is the test, vitest-style calls
with a literal title -- `test`, `it`, `describe`, `bench`, including `.only`/`.skip` and curried
`.each` forms -- are now `test` entities: that file reports the two added tests by name instead of
their plumbing.
