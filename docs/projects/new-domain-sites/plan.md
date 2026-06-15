# New Domain Sites

## Goal

Stand up sites for owned Cloudflare domains. Placeholders are acceptable for most.

## Sites

| Domain | Stack | Notes |
|---|---|---|
| davidjfelix.com | Astro | Index / resume site — scaffolded, deploy workflow ready |
| monicandavid.com | SvelteKit | Scaffolded 2026-06-12 — landing page, PandaCSS + Ark UI, CI |
| forzamonica.com | TanStack Start | Shop — scaffolded, see [forzamonica-shop](../forzamonica-shop/plan.md) |
| onvibes.org | Astro | Scaffolded 2026-06-12 — landing page, PandaCSS, CI |
| revision.city | TanStack Start | Scaffolded 2026-06-12 — landing page, PandaCSS + Ark UI, CI |
| pkg.dog / pkgdog.com | Nuxt (Vue) | Scaffolded 2026-06-12, moved to Nuxt 2026-06-13 — landing page, PandaCSS + Ark UI, CI |
| startchi.com | TanStack Start | Scaffolded 2026-06-12 — landing page, PandaCSS + Ark UI, CI |
| f311x.com | TanStack Start | Effect-native AI agent app -- see [f311x](../f311x/plan.md) |

All placeholder sites use PandaCSS (default `@pandacss/preset-panda`); non-Astro apps
take Ark UI as the component library (installed, unused until real components land).
The Vue app runs on Nuxt 4 (Nitro `cloudflare_module` preset) rather than a bare Vite
SPA, so it has a server story like the other meta-frameworks.

Type-checker policy (David, 2026-06-13): each framework uses its own native
type-checker; tsgo (`@typescript/native-preview`) is only for the case where the
alternative would be bare `tsc`. So: Astro → `astro check`, SvelteKit →
`svelte-check`, Nuxt → `nuxt typecheck` (vue-tsc), and the TanStack Start / React
apps → tsgo (no framework-specific checker; the alternative there is plain tsc).

Every app now has a `cd-deploy-*` workflow that ships to its workers.dev URL on
push to `main` (path-filtered to the app dir + its own workflow file). Custom domains
are wired in the Cloudflare dashboard and enabled as `custom_domain` routes in each
`wrangler.toml` (apex + www; pkg.dog also serves pkgdog.com) — wrangler reconciles
them on the next deploy.

## Related

- [Cloudflare Migration](../cloudflare-migration/plan.md) — these deploy to Cloudflare Workers
