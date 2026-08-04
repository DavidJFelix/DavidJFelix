### feat(revision.city): let a per-PR preview borrow sign-in from a stable origin

A preview cannot be an OAuth redirect target: GitHub rejects a `redirect_uri` it does not know, and
per-PR hostnames cannot be registered ahead of time. So the preview hands the dance to a stable
origin of the same worker, and that origin hands the authorization code back.

Three hops, all through the existing login and callback:

1. The preview binds its own state to the browser, then redirects to the stable origin's `/login`
   with `previewOrigin` and `previewState`.
2. That origin authorizes against its own registered callback, carrying both values in its state
   cookie.
3. Its callback sees them and redirects the code to the preview instead of exchanging it. The
   preview verifies its own state and completes the exchange itself.

Nothing but an authorization code crosses an origin, which is what OAuth already puts in a URL, and
it is inert without the client secret. No session, and no access token, is ever handed across. The
preview can finish the exchange because it is a version of the same worker and therefore holds the
same client secret -- that shared identity is the whole reason this needs no key exchange, no sealed
payload and no second app. The one subtlety is that the exchange must present the `redirect_uri` the
authorize used, which was the stable origin's; the preview records it when it delegates.

`parsePreviewOrigin` is the control: a code is forwarded only to an https host matching
`pr-<N>-<worker>.<subdomain>.workers.dev`, rebuilt from the parsed parts so no path, port or
credentials ride along. The state cookie is not signed, so the origin is re-validated when read back
rather than trusted. Production cannot delegate at all -- the branch requires a preview hostname.

Configuration is one variable, `PREVIEW_AUTH_BROKER_URL`, safe to set on the shared worker because
it only engages on preview hostnames.

This replaces an earlier sealed-handoff design that encrypted the session, bound it to a PKCE-style
verifier and redeemed it server-to-server. It was solving a problem this does not have: once only a
code crosses, there is nothing worth encrypting.
