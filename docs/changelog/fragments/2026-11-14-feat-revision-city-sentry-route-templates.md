### feat(revision.city): send route templates, not repository paths, to Sentry from the browser

The browser Sentry SDK now names page loads and route changes by route with the TanStack Router
integration. A new helper turns viewer and share-card paths into `/diffs/$path` and drops the diff
API query and the hash. The `beforeSendSpan` and `beforeSend` hooks apply it to span names, URL
attributes, the request URL and the breadcrumbs. PostHog and Honeycomb keep full paths.
