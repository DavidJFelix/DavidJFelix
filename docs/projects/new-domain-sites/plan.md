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
| pkg.dog / pkgdog.com | Vue | Scaffolded 2026-06-12 — landing page, PandaCSS + Ark UI, CI |
| startchi.com | TanStack Start | Scaffolded 2026-06-12 — landing page, PandaCSS + Ark UI, CI |
| f311x.com | TanStack Start | Effect-native AI agent app -- see [f311x](../f311x/plan.md) |

All placeholder sites use PandaCSS (default `@pandacss/preset-panda`); non-Astro apps
take Ark UI as the component library (installed, unused until real components land).
Type-checking is tsgo (`@typescript/native-preview`) everywhere except Astro
(`astro check`); the Svelte/Vue scaffolds skip svelte-check/vue-tsc until those
support TS 7. No CD workflows or custom-domain routes yet — wrangler configs serve
from workers.dev once a deploy workflow exists.

## Related

- [Cloudflare Migration](../cloudflare-migration/plan.md) — these deploy to Cloudflare Workers
