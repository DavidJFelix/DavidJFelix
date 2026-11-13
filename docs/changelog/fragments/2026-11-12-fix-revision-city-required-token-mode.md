### fix(revision.city): require a token mode for GitHub file reads

A GitHub file read now must say if it is signed in (with the visitor's token) or anonymous, or the
type check fails. Only an anonymous read uses the cache that all visitors share. Before, the mode
was optional and a read without it went to the shared cache; both callers already set it, so
visitors see no change. The unused fallback to a server token from the process environment is gone.
The file expansion endpoint takes injected `fetch` and app credentials, and has its own tests for
the sign-in gate, the session token, the error status and the refreshed cookie.
