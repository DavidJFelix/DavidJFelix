### docs(repo): close the sentry and posthog integration projects

Both cross-cutting observability rollouts are complete and live. The code side landed 2026-06-25:
all 11 deployed apps carry client-side Sentry behind the same-origin `/bugs` tunnel (server-side
`withSentry` on the TanStack Start apps + ravrun), and all 11 reverse-proxy PostHog through the
same-origin `/diag` path with cookieless `posthog-js`. The remaining human activation -- creating
the Sentry and PostHog projects and setting the per-app DSN/key vars (issue #261) -- is now done, so
everything is wired up and reporting. Per the project-docs convention, both project directories are
deleted and their entries removed from `docs/projects.md`; this fragment is the durable record.
