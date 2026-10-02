### chore(revision.city): move msw to v3

msw 3 renames the `onUnhandledRequest` option of `server.listen` to `onUnhandledFrame`, so the two
hook tests that passed the old name failed typecheck. They now pass `onUnhandledFrame: 'error'`,
which also restores the strict behavior: msw 3 ignored the unknown option and fell back to warning
on unhandled requests.

msw 3 also ships no `postinstall` script, so the web-apps workspace drops it from
`trustedDependencies`. Its other breaking changes (ESM only, no `setTimeout` patching, no cookie
store in Node, `graphql` moved to `msw/graphql`) touch nothing the tests use.
