### feat(revision.city): replace the GitHub PAT input with GitHub App sign-in

The diffs viewer's private-repo access no longer asks visitors to mint and paste a personal access
token. A "Sign in with GitHub" button (header settings dropdown and the /diffs home page) starts a
hand-rolled GitHub App web flow -- no auth library: `/diffs/api/auth/login` binds a random OAuth
state to the browser and redirects to GitHub, `/diffs/api/auth/callback` verifies the state and
exchanges the code for a user access token, and the session (token, login, expiry, optional refresh
token) lives in an HttpOnly SameSite=Lax cookie scoped to `/diffs`. `/diffs/api/auth/session`
reports the signed-in login for the UI without exposing the token, refreshing expiring tokens
through GitHub's refresh grant, and `/diffs/api/auth/logout` clears the cookie.

The diff proxy and file-expansion endpoints now read GitHub auth from that cookie instead of an
`Authorization` header supplied by the browser, so the client-side token plumbing
(localStorage token store, token forwarding in the patch loader and file loader, the paste-a-PAT
form) is deleted. Auth-failure hints and the rate-limit message now speak in terms of signing in
and installing the GitHub App rather than token scopes. The worker needs `GITHUB_APP_CLIENT_ID` and
`GITHUB_APP_CLIENT_SECRET` secrets; without them the auth routes 503 and the viewer stays
public-only.
