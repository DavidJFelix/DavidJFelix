### fix(revision.city): keep the session when a token refresh fails for a transient reason

A token refresh that fails with a 5xx, a body that is not JSON or a network error no longer clears
the session cookie. That request answers as signed out, and the next request tries the refresh
again. A refusal from GitHub (a body with an `error` field) still clears the cookie. The
`github auth failure` log event now has an `outcome` field, `refused` or `unavailable`.
