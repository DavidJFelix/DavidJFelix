### feat(revision.city): diff by function and symbol instead of by line

revision.city can now answer "which functions changed in this PR" rather than "which lines moved".
`src/symbols/lib/` parses both revisions of a file, extracts named entities (functions, classes,
methods, types, config keys), and matches them across the two trees, so a change is reported as
`Widget.render modified` or `welcome renamed from greet` instead of a hunk range. The engine is pure
and standalone; wiring it to a server route and a viewer panel is the next step.

Modelled on [sem](https://github.com/ataraxy-labs/sem), which does entity-level diffing in Rust over
tree-sitter, and which cannot run here: the app is a Cloudflare Worker viewing arbitrary GitHub PRs,
with nowhere to run a binary or clone a repo. Tree-sitter's WASM grammars do run on Workers, but
each grammar is a megabyte-plus of WASM that must be bundled and compiled at deploy. Lezer -- the
parser behind CodeMirror -- is plain JavaScript parse tables instead, so grammars bundle like any
other dependency, cost tens of kilobytes, and the WASM import seam disappears entirely. The matching
algorithm is sem's: exact qualified-name match, then structural-hash match to catch renames by an
identical body, then Sørensen-Dice token overlap above 0.8 for a rename that was also edited.

All fifteen first-party CodeMirror grammars that yield nameable symbols are wired: TypeScript, TSX,
JavaScript, JSX, Python, Rust, Go, Java, C/C++, PHP, CSS, Sass, Markdown, JSON and YAML. Lezer has
no query language -- there is no equivalent of tree-sitter's `tags.scm`, and those files cannot be
reused against Lezer trees -- so each grammar carries a typed table mapping its node types onto a
shared entity vocabulary, attached with `parser.configure({props})`. Because the table rides on the
node type via a `NodeProp` rather than a lookup keyed by name, a tree stitched from several grammars
resolves correctly with no extra bookkeeping. The tables are checked by `tsc` and each is covered by
a case in `extract-entities.test.ts`; adding a language is one file plus one case. HTML, XML and the
Lezer grammar itself are left out rather than shipped as empty results.

Two behaviors are deliberate and were found by testing against this repository's own history.
Entities carry a hash of their _own_ content, excluding nested entities, so a class is not reported
as modified merely because one of its methods was -- the change is attributed to the method alone.
And structural matching is skipped for entities under twelve tokens, because every one-line getter
hashes alike and the phase would otherwise invent renames between unrelated stubs; short bodies fall
through to token similarity, which compares actual text. Data formats are included for the same
reason a reviewer wants them: a manifest bump reports `dependencies.react`, and a workflow edit
reports `on.pull_request.paths`.

Guards keep it safe inside a Worker request: grammars load through dynamic imports so a request pays
only for the language it parses, the quadratic token phase is skipped past 200 unmatched entities,
and files with more than 2000 entities are reported as unsupported rather than silently truncated.
Replayed over the last twelve commits here, real file pairs diff in 2--80 ms each, correctly
reporting a fuzzy rename at 0.818 similarity and naming changed dependency keys. 59 tests cover
extraction for all fifteen languages, the three matching phases, language detection, and the
end-to-end differ.
