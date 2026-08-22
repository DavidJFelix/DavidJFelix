### chore(tooling): group renovate updates by org and framework

Renovate now bundles related packages into shared update PRs instead of moving them one at a time.
Framework stacks (astro, svelte, vue/nuxt, tanstack router/start/devtools, tailwind) and same-org
lockstep sets (sentry, ark-ui, radix, lezer, pierre, fontsource, unified markdown, testing-library,
alchemy/distilled, flue, effect) each get a single PR for every update type. Tools that live in both
mise and a package.json (oxc's oxlint/oxfmt, biome, cspell, sentry warden, the earendil pi packages)
group across both managers, and the node, bun, and react runtimes group with their `@types` packages
on major updates only. The cloudflare group now also carries `@cloudflare/workers-types`, and the
vite group hands the tailwind and tanstack vite plugins back to their release trains.
