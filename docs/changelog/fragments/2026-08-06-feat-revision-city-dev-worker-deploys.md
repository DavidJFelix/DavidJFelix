### feat(revision.city): deploy the dev worker and move previews onto it

The preview sign-in proxy needs `revision-city-dev` to actually run this app, and previews to be
versions of it. Both now flow from one `[env.dev]` wrangler environment:

- `wrangler.toml` gains `[env.dev]`: explicit `name = "revision-city-dev"`, `routes = []` (routes
  are inheritable -- without the empty list a dev deploy would reassign the production custom
  domains), `workers_dev = true` for the stable host, and `PREVIEW_AUTH_PROXY_URL` as an environment
  var, so previews learn where to proxy from config rather than a hand-set secret.
- The environment is selected at build time (`CLOUDFLARE_ENV=dev`): the Cloudflare vite plugin
  resolves it into `dist/server/wrangler.json`, which is what the redirected wrangler CLI deploys.
  `turbo.json` declares `CLOUDFLARE_ENV` on the build task so the variable reaches the build under
  strict env mode and the dev and production builds never share a cache entry.
- The app registry (`bin/plan-affected-apps.ts`) gains `devEnv`. An app that sets it previews as its
  dev worker only -- previews must share the dev GitHub App, never production's -- and deploys as
  both workers, so the dev worker's stable URL keeps tracking main. The preview action takes the
  environment as an input; the deploy matrix names jobs by worker now that one app can produce two.

Preview URLs move from `pr-<N>-revision-city.*` to `pr-<N>-revision-city-dev.*` as a consequence:
exactly the hosts the sign-in proxy's allowlist admits.
