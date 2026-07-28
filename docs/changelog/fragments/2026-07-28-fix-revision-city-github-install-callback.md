### fix(revision.city): land the GitHub App install flow instead of rejecting it

Installing the revision.city GitHub App -- granting an organization from the diffs viewer's access
prompt, or from GitHub's own app pages -- ends with GitHub redirecting the browser to the OAuth
callback carrying `?code=...&installation_id=...&setup_action=install`. That flow starts on
github.com rather than at `/api/auth/github/login`, so no state cookie ever bound it to the browser,
and the callback answered the successful installation with
`Invalid OAuth state. Start the sign-in again.`

The callback now recognizes the `setup_action` landing as "installation finished" rather than a
failed sign-in. A signed-in visitor is sent straight back into the app -- their token already sees
the new installation -- and a signed-out one is routed through the normal sign-in, which binds a
fresh state and completes without another prompt since GitHub has just been authorized. The
accompanying code is never exchanged: a code without a verified state stays untrusted, so the CSRF
protection the state check exists for is intact.

A Playwright suite (`src/github-auth.e2e.test.ts`) drives both landings against the booted worker.
It needs GitHub App credentials in the worker env and skips with a note when the auth routes answer
503 -- locally that means an `apps/revision.city/.dev.vars` with `GITHUB_APP_CLIENT_ID` and
`GITHUB_APP_CLIENT_SECRET` set (placeholder values suffice; nothing in these tests exchanges a
code), while the per-PR preview deploy inherits the worker's real secrets.
