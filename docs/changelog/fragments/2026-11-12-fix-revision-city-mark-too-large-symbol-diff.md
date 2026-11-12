### fix(revision.city): mark a symbol diff that was too large to read

A symbol diff for a file over a size limit now carries `skipped: 'too-large'`, and the client keeps
the mark. Before, that result looked the same as a file with no symbol changes. A parser stack
overflow on deeply nested input now also gives the too-large result, so `read_definition` answers
"too large" and the chunk review goes on. The Symbols tab does not show the mark yet.
