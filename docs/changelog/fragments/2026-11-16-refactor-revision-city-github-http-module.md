### refactor(revision.city): send GitHub calls through one HTTP module

A new `src/lib/github-http.ts` holds the GitHub API root, the API version, one User-Agent, one fetch
type, one header builder and one API URL builder. The patch endpoint, the sign-in module and the
access check use it and drop their own constants and header code. The other viewer modules move to
it in the next step. These requests now identify as `revision.city` instead of
`revision-city-diffs`.
