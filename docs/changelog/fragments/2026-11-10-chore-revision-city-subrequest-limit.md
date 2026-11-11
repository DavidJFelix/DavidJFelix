### chore(revision.city): raise the Worker subrequest limit for review runs

Cloudflare lets a Workflow instance make 10,000 subrequests by default. A review run at its size
limits can make about 115,000: 450 chunk reviews of at most 254 subrequests each, from OpenRouter
requests with their retries, blob reads and D1 queries. After the limit each later call fails, so
the run cannot report the failure and its check run stays in progress. `wrangler.toml` now sets
`[limits]` to 150,000 subrequests, and its comment gives the arithmetic. The limit applies to the
whole Worker, so the viewer routes get it too.
