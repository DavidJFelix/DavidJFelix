### fix(revision.city): read a pull request's base and head in one place

`readPullRequestRange`, `readRepoFullName` and `isSameGitHubRepo` now live beside `GitHubRepo` in
`github-diff-source.ts`, and the patch endpoint, the file loader and the pull request lists use
them. For a pull request whose fork is deleted, the file loader now reads the head side from the
base repository, as the patch endpoint already did, and not from the repository in the URL.
