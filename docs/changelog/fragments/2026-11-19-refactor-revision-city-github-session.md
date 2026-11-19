### refactor(revision.city): model the GitHub session with XState Store

The GitHub session of the page is now a store in `src/diffs/state/github-session-store.ts`, with the
states `idle`, `loading`, `authenticated`, `anonymous`, and `unknown`. A lookup starts only from
`idle` or `unknown`, and an answer counts only in `loading`. Thus the page has at most one lookup at
a time, and it looks up the session again only after a failed lookup. `useGitHubSession` keeps its
return value and reads the store. Before, a failed lookup made each mounted caller show the visitor
as signed out until a reload. Now a failed lookup goes to `unknown`, which the hook shows as signed
out, and the next window focus or hook mount asks again. The answer then reaches each mounted
caller.
