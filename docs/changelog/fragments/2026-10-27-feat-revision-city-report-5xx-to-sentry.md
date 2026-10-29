### feat(revision.city): report each 5xx response to Sentry

`withSentry` captured only errors that a request threw. A route that catches a failure and answers
5xx, such as the GitHub sign-in callback's 502, did not reach Sentry, and neither did an error that
TanStack Start turns into a 500. The worker entry now captures one `error` message for each 5xx
response, titled with the method, the path, and the status, such as
`GET /api/auth/github/callback answered 502`. The title has no query, so each route and status
groups as one issue. The console breadcrumbs of the request, such as the `github auth failure`
event, go with the message. The ReviewWorkflow is still not wrapped by Sentry.
