### fix(revision.city): answer 401 and 429 from the pull request list when GitHub does

The pull request list answered 502 for every failed GitHub search, so a rejected sign-in and a spent
search rate limit looked like an outage and filed a Sentry error. It now answers 401 with the reason
`sign-in-again` when GitHub rejects the token, and 429 with `Retry-After: 60` when the search rate
limit is spent. A 403 that is not a rate limit, such as an organization that enforces SSO, still
answers 502.
