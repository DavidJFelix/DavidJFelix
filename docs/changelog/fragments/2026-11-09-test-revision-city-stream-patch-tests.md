### test(revision.city): test the streamed patch parser

`streamGitPatchFiles` now has tests. They cover file starts cut across chunks, multi-commit patches
and their commit headers, a body with no `diff --git` line, empty and whitespace bodies, and
multi-byte characters cut between byte chunks. Two property tests check that any byte chunking gives
the same files as one chunk and that no text is lost. `fast-check` is a new dev dependency.
