### feat(revision.city): get GitHub App installation tokens

`createInstallationTokenSource` signs an RS256 JWT with the app's private key and exchanges it for
an installation token. The token can reach only one repository, with `checks: write`,
`contents: read`, and `pull_requests: write`. Calls share one token until 5 minutes before it
expires. The private key can be PKCS#1, as GitHub generates it, or PKCS#8. Nothing uses the tokens
yet.
