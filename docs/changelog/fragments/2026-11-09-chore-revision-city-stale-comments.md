### chore(revision.city): remove stale comments and plan text

Comments and the project plan said things that stopped being true. The worker-side Sentry note now
names `VITE_PUBLIC_SENTRY_DSN`, the note about a preview sign-in broker that was replaced is gone,
and the Playwright config names `cd-preview-web-apps.yml`. The revision.city plan no longer calls
the site a placeholder or reviews unscoped, links the reviews plan, and links the app's real path.

Four tests read a mocked request with `String()` under a lint suppression. They now read the URL and
body with type checks, so the suppressions are gone.
