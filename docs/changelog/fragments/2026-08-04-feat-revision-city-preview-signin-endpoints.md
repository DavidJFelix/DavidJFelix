### feat(revision.city): wire the brokered preview sign-in endpoints

The sealed-handoff core now has the four endpoints it was built for, so a per-PR preview can borrow
sign-in from a broker on a stable host.

- `preview-start` (preview) mints a verifier, keeps it in an HttpOnly cookie on the preview origin,
  and redirects to the broker carrying only its SHA-256.
- `preview-authorize` (broker) refuses any origin that is not an https per-PR preview host, requires
  a session on the broker's own origin -- routing through its normal OAuth when there is none, and
  returning to itself afterwards -- then seals that session against the challenge.
- `preview-callback` (preview) redeems the handoff server-to-server by presenting the verifier, and
  writes the session cookie for the preview origin.
- `preview-redeem` (broker) opens a handoff for whoever can produce the matching verifier. It is
  POST so the verifier never lands in a URL, and it answers identically for an expired, forged,
  tampered or wrong-verifier handoff so probing it teaches nothing.

`/api/auth/github/login` branches rather than the UI: on a preview host with a broker configured it
starts the handoff, everywhere else it runs the normal OAuth. The sign-in button is unchanged, and
production can never hand sign-in off because the branch requires a preview hostname.

Configuration is two variables, deliberately split so neither deploy holds more than it needs.
`PREVIEW_AUTH_BROKER_URL` tells a preview where to go; `PREVIEW_AUTH_HANDOFF_KEY` is the broker's
sealing key, and a worker without it simply is not a broker -- those endpoints answer 404.

18 tests cover the wiring: the branch decision, the allowlist refusing another site, a look-alike
host and a plain-http downgrade, the unauthenticated bounce through the broker's own sign-in, a
missing verifier cookie, a broker that will not redeem, and that the callback redeems over POST
rather than passing the token through a URL. The `readSession` normalizer is now shared with the
preview side rather than reimplemented there.

The GitHub App, its secrets, and the broker deploy are human setup, tracked in their own issues.
