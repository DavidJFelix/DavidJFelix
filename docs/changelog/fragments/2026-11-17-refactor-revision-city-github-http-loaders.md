### refactor(revision.city): move the GitHub loaders and lists to the shared HTTP module

The file loader, the share-card pull request lookup, the pull request search and lists, and the
installations read now use `src/lib/github-http.ts`, and drop their own API root, API version,
User-Agent, fetch type and header code. Their requests now identify as `revision.city` instead of
`revision-city-diffs` or `pierre-diffs`. Every viewer request to GitHub now has the same User-Agent.
