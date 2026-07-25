### feat(revision.city): replace the GitHub PAT input with GitHub App sign-in

The diffs viewer's private-repo access no longer asks visitors to mint and paste a personal access
token. A "Sign in with GitHub" button (header settings dropdown and the /diffs home page) starts a
hand-rolled GitHub App web flow -- no auth library: `/api/auth/github/login` binds a random OAuth
state to the browser and redirects to GitHub, `/api/auth/github/callback` verifies the state and
exchanges the code for a user access token, and the session (token, login, expiry, optional refresh
token) lives in an HttpOnly SameSite=Lax cookie. `/api/auth/github/session` reports the signed-in
login for the UI without exposing the token, refreshing expiring tokens through GitHub's refresh
grant, and `/api/auth/github/logout` clears the cookie.

The diff proxy and file-expansion endpoints now read GitHub auth from that cookie instead of an
`Authorization` header supplied by the browser, so the client-side token plumbing (localStorage
token store, token forwarding in the patch loader and file loader, the paste-a-PAT form) is deleted.
Auth-failure hints and the rate-limit message now speak in terms of signing in and installing the
GitHub App rather than token scopes. The worker needs `GITHUB_APP_CLIENT_ID` and
`GITHUB_APP_CLIENT_SECRET` secrets; without them the auth routes 503 and the viewer stays
public-only.

Server routes also moved out from under the viewer into a top-level `/api` namespace, grouped by
subject rather than by the page that calls them: the two diffs endpoints are now `/api/diffs/diff`
and `/api/diffs/github-diff-file` (previously `/diffs/api/...`), and auth is namespaced by provider
so a second one would slot in beside GitHub.
