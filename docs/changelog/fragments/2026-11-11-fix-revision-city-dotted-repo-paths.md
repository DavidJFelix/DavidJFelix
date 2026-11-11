### fix(revision.city): accept a dotted repository name in a bare diff path

The diff form refused a bare path such as `owner/repo.js/pull/1` and showed "Please enter a valid
URL", but the same pull request opened from a full URL or from `owner/repo.js#1`. The bare path
pattern refused a dot in the owner and in the repository segment. Now only the owner segment has no
dot, because a dot there shows a host name such as `github.com`.
