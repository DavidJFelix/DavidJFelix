### fix(revision.city): limit the size of the files that Symbols reads

The entity diff route reads each file of a GitHub or Codeberg diff and then parses it. It now stops
at 1 MB, the same limit the reviewer's file reads use. A file with a larger `Content-Length` is
refused before its body is read, and a file with no `Content-Length` is read only until it goes past
the limit. The file then gets the same empty result as a file that is too large to extract. The
GitHub and Codeberg file loaders take the limit as an option, so the diff viewer's full-file reads
do not change.
