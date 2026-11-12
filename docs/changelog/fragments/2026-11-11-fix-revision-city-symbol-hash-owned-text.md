### fix(revision.city): count owned text and shape in symbol hashes

The Symbols tab now reports a `modified` row for an edit to text that a syntax node holds between
its children, such as an escaped string, a template literal, a Python f-string, a CSS length, a Rust
`?` or a C++ `->`. Before, the hashes read only leaf text, so these edits gave no row. The hashes
also read the tree shape with a close marker after each node's children, so a statement moved out of
an `if` is now an edit. Reformats, comment edits, CRLF and indentation changes still give no row.
Two Markdown headings with different text are no longer paired as a rename.
