# forzamonica.com (Forza Monica Shop)

## Status

**Blocked** (2026-06-18) — scaffold is complete and verified against mock.shop, but production is
gated on two human tasks (filed as GitHub issues): create the Shopify store + Headless channel +
Storefront token, and register forzamonica.com + add the zone to Cloudflare. Parked until David
clears those.

## Goal

Stand up forzamonica.com as a headless Shopify storefront: TanStack Start on Cloudflare
Workers for the frontend, the Shopify Storefront API for catalog and cart, and
Shopify-hosted checkout. This replaces the "placeholder for now" line item from the (now closed)
new-domain-sites project.

## Architecture

- **App**: `apps/forzamonica.com` — TanStack Start (React 19), PandaCSS + Ark UI,
  deployed with plain `wrangler deploy` via `@cloudflare/vite-plugin` (deliberately not
  Alchemy while f311x shakes out).
- **Shopify**: all Storefront API calls go through TanStack Start server functions
  (`src/lib/shopify/`), so access tokens stay server-side. Cart ID lives in an httpOnly
  cookie. Checkout redirects to the cart's `checkoutUrl` (Shopify-hosted).
- **mock.shop first**: the storefront is fully wired against
  [mock.shop](https://mock.shop), Shopify's hosted mock Storefront API. Catalog, product
  pages, and cart work end-to-end with zero credentials. Cutover to the real store is
  config-only: `SHOPIFY_STOREFRONT_API_URL` var + `SHOPIFY_STOREFRONT_PUBLIC_TOKEN`
  secret.
- **Repo firsts**: this app establishes the Ark UI + PandaCSS pattern (slot recipes in
  `panda.config.ts`; `QuantityField` is the reference component) and the TanStack Start +
  wrangler-deploy combination (f311x uses Alchemy).

## Phases

### Phase 1 — Scaffold (done 2026-06-11)

- [x] App scaffold with repo-standard toolchain (tsgo, Biome+Oxlint, Vitest, mise tasks)
- [x] Catalog, product detail, and cart routes working against mock.shop (verified end to
      end, including cart mutations)
- [x] CI (`ci-forzamonica-com.yml`) and CD (`cd-deploy-forzamonica-com.yml`) workflows

### Phase 2 — Accounts & plumbing (human)

- [x] Cloudflare deploys use the shared `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
      secrets like the other apps (decided 2026-06-12); no per-app secrets
- [ ] Shopify store + Headless channel + Storefront API token (GitHub issue)
- [ ] Register forzamonica.com and add the zone to the account, then restore the
      `routes` block in `wrangler.toml` (GitHub issue; worker serves from workers.dev
      until then)
- [ ] First production deploy on merge to main

### Phase 3 — Real store cutover

- [ ] Point `SHOPIFY_STOREFRONT_API_URL` at the real store; set token secret
- [ ] Real products, collections as needed
- [ ] Brand/theme pass (tokens in `panda.config.ts` are placeholder red/neutral)

### Phase 4 — Polish & instrumentation

- [ ] Sentry + PostHog per the cross-app instrumentation projects
- [ ] Preview deployments once that project lands its pattern
- [ ] Collections, search, richer PDP as the catalog warrants

## Links

- App: [`apps/forzamonica.com`](../../../apps/forzamonica.com/)
- new-domain-sites — the originating line item (project closed; recorded in the
  [changelog](../../changelog/2026-06.md))
- preview deployments — the per-PR preview/smoke/screenshot bar this app adopts (shipped repo-wide
  2026-06-17; see the changelog)
