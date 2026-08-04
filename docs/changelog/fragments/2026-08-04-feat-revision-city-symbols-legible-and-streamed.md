### feat(revision.city): say what a symbol change is, and stream the batch

Two changes to the symbols tab: one so a row can be read, one so the results arrive as they are
computed.

**The marks now say what they mean.** A bare sigil in a colored column was the only statement of
what happened to a symbol, and one of the sigils was actively wrong: the file tree uses `M` for
_modified_, while this panel used `M` for _moved_ and `~` for modified -- the same letter meaning
two things in adjacent panels. The letters are now the tree's own Git-status vocabulary (`A`, `M`,
`R`, `D`), with an arrow for moved, which has no Git-status counterpart and should not steal a
letter. Each row also spells the change out beside the kind -- "renamed fn", "modified method",
"added interface" -- so the sigil is a scanning aid rather than the only place the answer lives. A
summary line above the list gives per-bucket totals in the same colors and words, which doubles as
the legend.

**The work already ran on the server; now the results stream.** Both revisions were always parsed in
the worker -- no grammar has ever reached the browser -- but the transport was one HTTP request per
file, fanned out four at a time from the client. It is now a single POST per batch that answers with
newline-delimited JSON, one line per file in completion order, so the panel fills in as each file
lands instead of the client managing its own concurrency. A file that fails to read arrives as its
own line and does not end the stream.

Batching is what keeps that safe: a worker request has a bounded subrequest budget and each file
costs up to two GitHub blob reads, so the client sends twenty files at a time rather than all of
them. The cap lives in the client module rather than the endpoint, so importing it does not pull the
server module -- and with it every grammar -- into the browser bundle. The build is checked for
exactly that: the client bundle contains no Lezer at all, while the server keeps its twelve lazily
loaded grammar chunks.

Verified by unit tests over the stream reader (chunk-split lines, a missing trailing newline, a
malformed line, per-file errors), the endpoint's batch limit and validation, and Playwright specs
driving the real viewer -- including a signed-out visitor getting a populated panel.
