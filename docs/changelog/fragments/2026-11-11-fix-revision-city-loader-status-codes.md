### fix(revision.city): answer loader input errors and upstream 4xx with 4xx

The GitHub and Codeberg file endpoints answered 502 for every loader error, so a bad path, a missing
file or a revoked token showed in Sentry as a server error. A loader error now carries an HTTP
status in its `cause`. A path that the loader does not support gives 400, a GitHub rate limit gives
429, and a 4xx from GitHub or Codeberg passes through. Only other failures still give 502.
