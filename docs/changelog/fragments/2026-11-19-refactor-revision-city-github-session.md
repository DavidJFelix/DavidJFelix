### refactor(revision.city): model the GitHub session with XState Store

The GitHub session of the page is now a store in `src/diffs/state/github-session-store.ts`, with the
states `idle`, `loading`, `authenticated`, `anonymous`, `unknown`, and `retrying`. A lookup starts
only from `idle`, and a retry starts only from `unknown`, when a hook mounts after a failed lookup.
An answer counts only in `loading` or `retrying`. `useGitHubSession` keeps its return value and
gives the latest answer, so the account menu shows a retry that succeeds. A retry shows as
`anonymous`, not as `loading`, so no caller hides its content during a retry. The store also keeps
the first answer of the page, and a failed first lookup counts as `anonymous`. The diff viewer reads
it through `useFirstGitHubSession`, so its session does not change after the viewer is shown. The
store declares its context and its events in `schemas`, with `zod/mini`, and its types come from
these schemas. The store does not validate against the schemas, so they do not change its behavior.
