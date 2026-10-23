### fix(revision.city): rate limit the entity diff route

The entity diff route parses pull request files for anyone, signed in or not. A crafted file can use
the whole CPU limit of a request. Now a Workers rate limiting binding lets each client IP send 20
requests in 10 seconds, and the route answers 429 to the rest. Production and the dev worker, with
its previews, share one count.
