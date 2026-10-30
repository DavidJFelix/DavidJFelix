### feat(revision.city): expand full files on Codeberg diffs

The diff viewer now shows unchanged context lines on Codeberg pull requests and commits. A new
`/api/diffs/codeberg-diff-file` route reads both revisions of a file from the Codeberg API
(`/api/v1/repos/<owner>/<repo>/raw/<path>?ref=<sha>`) with no credentials. For a pull request, the
route reads the merge base and the head from the base repository. For a commit, it reads the commit
and its first parent. Compares still have no full-file expansion, because the API gives no merge
base for a compare range. The browser loader moves to `diff-file-loader.ts`, which now holds the
GitHub and the Codeberg loader.
