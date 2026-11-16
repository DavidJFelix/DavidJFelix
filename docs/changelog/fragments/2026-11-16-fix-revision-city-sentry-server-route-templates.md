### fix(revision.city): send route templates, not repository paths, to Sentry from the server

The server Sentry SDK now applies the telemetry scrub helper in `beforeSendSpan`, `beforeSend` and
`beforeBreadcrumb`. Request names and the 5xx message title use the route template, such as
`GET /diffs/$path answered 502`. Outgoing calls keep only their origin. Console breadcrumbs keep the
origin of each URL and lose `repository` fields, and wide events give no breadcrumb. The log lines
in Workers Logs and Honeycomb do not change.
