### fix(revision.city): list no pull requests instead of 502 for an account with nothing searchable

The pull request list endpoint answered 502 for a signed-in visitor who had no pull requests or had
not granted the GitHub App access to any repository. GitHub's search answers 422 Validation Failed,
not an empty page, when a `user:`, `org:`, or `repo:` qualifier names nothing the token can search,
and the endpoint treated every non-ok answer as GitHub being unavailable. That 422 now reads as an
empty result for the group it scopes, so the visitor sees an empty list while rate limits and
outages still surface as 502.
