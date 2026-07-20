### fix(deps): repair the breakage from the npm patch/minor renovate round

The npm patch/minor renovate batch moved four things that needed hand-fixing before the round could
land green. In f311x, alchemy 2.0.0-beta.61 reorganized its Cloudflare module into namespaces, so
`Cloudflare.AccountApiToken` became `Cloudflare.ApiToken.AccountApiToken` (github.ts) and
`Cloudflare.Vite` became `Cloudflare.Website.Vite` (alchemy.run.ts). Still in f311x, effect is
capped at 4.0.0-beta.94: beta.97 removed `Schedule.either`, which alchemy (already at its newest v2
beta) still calls in its state store and Cloudflare resources, so deploys died at runtime with
`TypeError: Schedule.either is not a function`. In onvibes.org, bumping the direct `hono` to 4.12.29
left `@flue/runtime`'s copy resolved at 4.12.27, and the two `Hono` types no longer unify across
that version gap -- `pnpm dedupe hono` collapses the tree back to a single copy.

In djf.io, the lockfile refresh pulled in rolldown 1.1.5, which drops vite-ignored external dynamic
imports (the pagefind loader in Search.astro) from chunk `dynamicImports` metadata. Astro's script
inliner then judged the search script inline-safe and folded it into every page's HTML before Vite
substituted the `__VITE_PRELOAD__` marker, so each page threw a `ReferenceError` and search went
dead -- caught by the Search e2e suite. rolldown is pinned to 1.1.4 via a commented override in the
app's `pnpm-workspace.yaml` until the metadata regression is fixed upstream.
