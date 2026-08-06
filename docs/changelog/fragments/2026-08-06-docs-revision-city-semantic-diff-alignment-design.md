### docs(revision.city): design the sibling-alignment fix for over-verbose config diffs

The Symbols tab reports PR #409's three-edit `.config/cspell.jsonc` change as 21 rows, because
sibling entities that share a name are numbered by document order (`name#2`) and the matcher trusts
that ordinal as identity -- one array insertion shifts every later sibling and cascades into fifteen
bogus `modified` rows, with the `added` rows attached to the wrong object entirely.

This session designs and prototype-validates the fix, captured in
`docs/projects/revision-city/2026-08-06-progress.md`: align repeated-name occurrence sequences by
content (LCS on content hashes) instead of ordinal position, attach element-level sequence detail to
array-valued properties so a scalar array reports `167 -> 169, "ciphertext" inserted at index 9`
rather than a bare `modified`, and roll up entity rows that sit inside an inserted or deleted
element. Run against the real PR #409 blobs, the prototype reproduces the intended report exactly:
three rows, one per changed array, with sizes and insertion indexes.
