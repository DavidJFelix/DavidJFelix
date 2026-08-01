# forzamonica.com

Headless Shopify storefront for Forza Monica. Source of truth for scope and decisions:
[`docs/projects/forzamonica-shop/plan.md`](../../docs/projects/forzamonica-shop/plan.md).

## Stack

- TanStack Start on Cloudflare Workers (`@cloudflare/vite-plugin` + `wrangler deploy`)
- PandaCSS for styling, Ark UI for headless components
- Shopify Storefront API (GraphQL) for catalog and cart; Shopify-hosted checkout

The storefront currently points at [mock.shop](https://mock.shop), Shopify's hosted mock Storefront
API — full schema, no store or token required. Cutover to the real store is config-only: change
`SHOPIFY_STOREFRONT_API_URL` in `wrangler.toml` and set the `SHOPIFY_STOREFRONT_PUBLIC_TOKEN`
secret.

## Getting started

```bash
bun install
bun run dev
```

App boots on `http://localhost:3002`.

## Scripts

|                     |                               |
| ------------------- | ----------------------------- |
| `bun run dev`       | Vite dev server (workerd SSR) |
| `bun run build`     | Production build              |
| `bun run deploy`    | Build + `wrangler deploy`     |
| `bun run lint`      | Oxlint + Biome                |
| `bun run typecheck` | `tsc --noEmit`                |
| `bun run test`      | Vitest                        |

`mise run check` runs the full canonical check suite (see `mise.toml`).
