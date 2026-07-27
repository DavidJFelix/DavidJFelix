### feat(revision.city): offer a way out when a signed-in visitor lacks repo access

Signing in with GitHub authorizes the app; it does not grant it any repository. Until now the diffs
viewer treated the gap between the two as a dead end -- a private diff the GitHub App had not been
granted produced `Failed to fetch patch from authenticated pull metadata: 404 Not Found.` followed
by a sentence telling the reader to go install the app somewhere, with no link and nothing to click
but "Try again".

The diff endpoint now diagnoses access failures into one actionable step instead of describing the
attempt that failed. GitHub hides invisible repositories behind a plain 404, so the diagnosis asks
in turn: is the token still good (`/user`), can it see the repository (`/repos/{owner}/{repo}`), and
does the app have an installation on that owner (`/user/installations`). Those three answers
separate cases the old message ran together -- an expired session, an SSO or rate-limit block, an
app that is not installed on the owner at all, an app that is installed but was never granted this
repository, and a readable repository whose pull request simply does not exist.

Failures answer in JSON now, carrying the message plus the remedy that clears it, so the viewer's
error panel can render the way out as its primary button: "Grant access on GitHub" pointing at the
existing installation's settings when there is one and at the app's install page when there is not,
or "Sign in with GitHub" for a visitor who never signed in and hit a private diff. Granting happens
in a new tab, and the diff reloads by itself when the reader comes back to this one. Where the owner
is not the signed-in account, the copy says up front that GitHub may route the grant to an owner for
approval. Remedy URLs are re-checked against github.com before the panel renders one.

Hitting the wall is no longer the only way to reach the grant. The signed-in GitHub panel -- in the
header dropdown and on the `/diffs` home page alike -- carries a standing "Manage repository access"
link, so a repository can be granted before anyone tries to read a diff from it, and a second one
added later without waiting to be blocked again. Which GitHub page that lands on depends on
installations only the session's token can read, so it resolves at the click through a new
`/api/auth/github/installations` route: the installation's own settings page when there is exactly
one, and the install page's account picker when there are none or several. A visitor whose session
lapsed between page load and click is sent through sign-in rather than an error.

The app's public slug is a constant rather than configuration -- one GitHub App serves every deploy
today, and a second environment would want an app of its own before this needed to vary.
