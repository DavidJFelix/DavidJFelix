### feat(revision.city): report the OAuth callback a deploy needs registered

`GET /api/auth/github/config` answers `{configured, callbackURL}`: whether this deploy has GitHub
App credentials, and the exact OAuth callback URL it will ask GitHub for. Open it on any origin to
get the string that has to be registered.

This exists because every deploy derives its callback from the host it is served on, and GitHub
rejects a `redirect_uri` it does not already know. A per-PR preview therefore stays signed out --
and so falls back to unauthenticated GitHub reads, whose rate limit is shared across a Cloudflare
egress IP -- until its own callback URL is added to the GitHub App. Nothing about that was
discoverable from the app; the failure surfaced as GitHub's own error page or an unexplained rate
limit.

Safe to expose: `configured` is a presence check rather than a value, and the callback URL is built
from the requested host, which the caller already knows. A test asserts the client secret never
appears in the response.
