### test(revision.city): test the Symbols GitHub read signed in and signed out

The Symbols endpoint now has tests for a GitHub read. A signed-out read sends no token and gives a
diff. A signed-in read sends the session token and does not put its files in the cache that all
visitors share. An expired session token is refreshed, and the new session cookie reaches the
browser. The endpoint now takes the app credentials as an option, as the other GitHub endpoints do,
so that the tests can supply them. The old signed-out test could not fail and is gone.
