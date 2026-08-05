### feat(revision.city): proxy preview sign-in through the dev worker

A per-PR preview cannot be an OAuth redirect target: GitHub rejects a `redirect_uri` it does not
know, and per-PR hostnames cannot be registered ahead of time. So a preview asks the dev worker --
which has its own GitHub App and a registered callback -- to run the dance and hand the
authorization code back.

1. The preview binds a CSRF value to the browser in its own cookie, then redirects to the dev
   worker's `/login` with `proxyAuthTo` (its own callback URL) and that value as `state`.
2. The dev worker validates the requested callback, then authorizes against its own registered
   callback with `state` set to base64 `{csrf, proxyAuthTo}`.
3. GitHub echoes that `state` back. The dev worker decodes it, re-validates the target, and
   redirects the code to the preview's callback with the CSRF value.
4. The preview checks the CSRF against its cookie and completes the token exchange itself.

Everything the dev worker needs rides in `state`, so it stores nothing across the round trip --
nothing to expire or collide when two previews are signed into from one browser. Only the
authorization code crosses an origin, which is what OAuth already puts in a URL and is inert without
the client secret. The preview can finish the exchange because it is a version of the dev worker and
shares that secret; the one subtlety is that the exchange must present the `redirect_uri` the
authorize used -- the dev worker's -- which the preview records when it delegates.

`parseProxyCallbackURL` is the control, applied on the way out and again on the way back: a code
goes only to `/api/auth/github/callback` on an https `pr-<N>-…workers.dev` host, rebuilt from the
parsed parts. Fixing the path matters as much as the host -- a valid preview must not be usable to
aim a code at some other route. Production cannot proxy at all; the branch requires a preview
hostname.

One variable, `PREVIEW_AUTH_PROXY_URL`, pointing previews at the dev worker.

This replaces a sealed-handoff design that encrypted the session, bound it to a PKCE-style verifier
and redeemed it server-to-server. Carrying the state through GitHub instead of a cookie, and moving
a code instead of a token, removes the need for any of it.
