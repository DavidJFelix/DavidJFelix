### fix(revision.city): give a signed-out diff a second route when GitHub turns the first away

A signed-out visitor's diff had exactly one route to GitHub: the public `.diff` URL on github.com,
fetched from the Worker's shared egress address, with GitHub's status passed straight through. A
signed-in visitor's request retried the same route with their token and then the REST API, which is
why a 503 on that first route reached only signed-out readers. Now the signed-out chain has a
fallback too: the REST API with the app's own client id and secret as basic auth, the same
credentials the share cards use, which GitHub answers with public data only at the app's rate limit
rather than the anonymous per-address one. A private repository still reads as a 404 either way, so
that fallback is skipped after a 404 and the existing sign-in remedy stands; the access diagnosis
that names the obstacle now runs once, on the last attempt, instead of after every attempt in the
chain.

When every route turns a signed-out request away with an outage-shaped status, a 5xx or a 429, the
error panel offers "Sign in with GitHub" instead of a bare status, since a signed-in request travels
routes the anonymous one cannot. Non-GitHub patches keep the plain status: signing in does nothing
for them. Every failed attempt is logged as one structured line for Workers Logs, naming the route,
the identity it was tried as, GitHub's status, and its throttling headers, so the next signed-out
503 can be told from a rate limit without reproducing it; a handled failure is not an exception, so
nothing else recorded it. The endpoint gained its first unit tests, covering the chain for each
identity, the 404 short-circuit, the remedy, and the log lines.
