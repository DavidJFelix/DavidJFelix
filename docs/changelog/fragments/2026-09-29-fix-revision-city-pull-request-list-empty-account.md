### fix(revision.city): list no pull requests instead of 502 for an account with nothing searchable

The pull request list endpoint answered 502 for a signed-in visitor who had no pull requests or had
not granted the GitHub App access to any repository. GitHub's search answers 422 Validation Failed,
not an empty page, when a `user:`, `org:`, or `repo:` qualifier names nothing the token can search,
and the endpoint treated every non-ok answer as GitHub being unavailable. That 422 now reads as an
empty result for the group it scopes, so the visitor sees an empty list while rate limits and
outages still surface as 502. Only the 422 whose body names the query as the invalid field counts;
the one GitHub also uses for abuse throttling still answers 502.

GitHub rejects a whole search for one such qualifier, so the member and watched groups now search
only organizations and repositories the app is installed on, read from the app's installations and
their repository grants, instead of losing a group's pull requests to one it was not granted. A
query GitHub still rejects over several qualifiers leaves that group marked truncated rather than
silently empty.
