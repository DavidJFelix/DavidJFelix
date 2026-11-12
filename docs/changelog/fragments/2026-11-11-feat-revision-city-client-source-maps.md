### feat(revision.city): upload hidden client source maps to Sentry

When the Sentry token, org and project are all set, the client build makes hidden source maps,
uploads them to Sentry with `@sentry/vite-plugin` and then deletes them, so the asset server never
serves them. Sentry can then show the original source lines for a client error. A build without one
of the three variables is the same as before.
