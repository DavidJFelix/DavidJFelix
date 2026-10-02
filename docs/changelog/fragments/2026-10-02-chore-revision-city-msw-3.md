### chore(revision.city): move msw to v3

msw 3 renames the `onUnhandledRequest` option of `server.listen` to `onUnhandledFrame`, so the two
hook tests that passed the old name failed typecheck. They now pass `onUnhandledFrame: 'error'`,
which also restores the strict behavior: msw 3 ignored the unknown option and fell back to warning
on unhandled requests.
