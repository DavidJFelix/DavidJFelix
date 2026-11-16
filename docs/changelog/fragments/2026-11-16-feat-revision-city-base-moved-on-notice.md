### feat(revision.city): say when a compare's base branch moved on

A GitHub compare diffs from the merge base, so commits that landed on the base branch later are not
in the diff. When a signed-in visitor opens a three-dot or one-ref compare whose base has such
commits, the sidebar now shows a row such as "main moved on 3 commits since the merge base". The
count is `behind_by` from GitHub's compare answer, read through a new
`/api/diffs/github-compare-status` route. Signed-out visitors, two-dot compares, and pull requests
get no row.
