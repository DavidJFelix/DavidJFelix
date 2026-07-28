### chore(tooling): group wrangler and the cloudflare vite plugin in renovate

`wrangler` and `@cloudflare/vite-plugin` ship as a matched pair -- the plugin pins the
miniflare/workerd runtime to a specific wrangler release -- but Renovate treated them as independent
npm updates, so one could bump without the other and majors landed in separate PRs. A new package
rule groups every update type for both packages into a single `cloudflare wrangler and vite plugin`
PR that moves them across all apps at once, converging every app on the same versions of each.
