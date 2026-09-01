### refactor(onvibes.org): remove Flue and rebuild as a TanStack Start app

Flue is out as onvibes.org's agent framework; TanStack AI (with TanStack Start) replaces it. The
Astro app went with it: onvibes.org is now a TanStack Start app on Cloudflare Workers, modeled on
startchi.com — same Panda setup, theme bootstrap/toggle, PostHog `/diag` reverse proxy, Sentry
`/bugs` tunnel, og tags, smoke gate, and Playwright suite. The chat page and its keyless faux echo
agent are gone; chat returns on TanStack AI once the model provider and auth questions are settled.

Fallout cleaned up along the way:

- The Flue-era workspace pins (`@earendil-works/pi-ai`, `@modelcontextprotocol/sdk`, `hono`) left
  `workspaces/web-apps/package.json`, and the `@flue` Renovate group is gone.
- The isolated per-PR preview-worker machinery (`cd-preview-onvibes-org.yml`, the
  `preview-worker`/`preview-worker-teardown` actions, `bin/deploy-preview-worker.ts`,
  `bin/teardown-preview-worker.ts`) existed only because the Worker carried Flue's Durable Object
  migrations. Deleted; onvibes.org now previews and deploys through the shared web-apps matrices.
- `cd-deploy-web-apps.yml` now also exports `VITE_PUBLIC_SENTRY_DSN`/`VITE_PUBLIC_POSTHOG_KEY`, so
  the TanStack Start apps' inlined observability config gets the same per-app values the Astro apps
  read via `PUBLIC_*`.
- The onvibes.org project plan doc was retired (`docs/projects/onvibes-org/`).

One-time operational step: the deployed `onvibes-org` Worker carries Flue's Durable Object migration
history, which the new config neither declares nor exports. Delete the Worker in Cloudflare before
the next deploy (the deploy recreates it clean) and re-attach the onvibes.org/www custom domains.
