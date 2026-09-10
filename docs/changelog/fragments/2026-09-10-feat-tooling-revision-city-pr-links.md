### feat(tooling): comment revision.city diff links on every pull request push

A new `ci-revision-city-links` workflow comments on each pull request when it opens and on every
push after that, linking the PR and each commit to the revision.city diff viewer
(`https://revision.city/diffs/<owner>/<repo>/pull/<n>` and `.../commit/<sha>`). It is a new comment
per push rather than a sticky one, so the thread reads as a log of what each push changed: the
opening comment lists every commit, and a later push lists only the commits it added -- the
`before...after` compare intersected with the PR's own commits, so a rebase onto main or a merge
from main does not drag main's history in; when GitHub can no longer compare against the old head,
every commit is listed instead. The list and the comment body come from
`bin/comment-revision-city-links.ts`, tested beside it. Fork PRs are skipped, since their token is
read-only and could not post.
