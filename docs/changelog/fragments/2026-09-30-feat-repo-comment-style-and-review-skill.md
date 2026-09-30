### feat(repo): comment style guide and a Warden comment-review skill

A new style guide, `docs/contributing/comment-style.md`, says when a comment earns its place and how
it is worded. A comment is the last resort after renaming, typing, and restructuring; it says why,
states an external fact, or warns, and never narrates a loop or a branch. Comments are written in
ASD-STE100 Simplified Technical English, documentation adds the ubiquitous language from the context
glossaries, and prose describes the system in the domain's terms along named data flows. Doc-format
comments (TSDoc, rustdoc, docstrings, godoc, HexDocs) belong only on the exported surface of shared
and published packages; a request for them elsewhere is settled by amending the guide's edge-case
list, not by adding the comment.

The guide is enforced by `comment-review`, the first repo-authored Warden skill
(`.agents/skills/comment-review/`, symlinked into `.claude/skills/`). Warden discovers it from
`.agents/skills/` and runs it on every non-draft PR beside the built-in `security-review` and
`code-review`, with the same triggers, and it reports findings in the same shape as the built-ins.
Two reference files carry the Simplified Technical English digest and the per-language doc comment
formats. This starts phase 3 of the review-consolidation project: encoding the repo's own standards
as Warden skills.
