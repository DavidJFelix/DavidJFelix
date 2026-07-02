# forzamonica.com (Forza Monica Shop)

## Status

**Active** (2026-07-02) — the domain blocker is cleared (#223 closed; David reports forzamonica.com
is attached to the worker, though the `routes` block in `wrangler.toml` is still commented out and
should be reconciled). The Shopify store + token (#222) remains the gate for the real-catalog
cutover; until then the storefront builds against mock.shop. Site map + shared layout landed
2026-07-02 (about, policies, 404, footer, cart badge).

## Goal

Stand up forzamonica.com as a headless Shopify storefront: TanStack Start on Cloudflare Workers for
the frontend, the Shopify Storefront API for catalog and cart, and Shopify-hosted checkout. This
replaces the "placeholder for now" line item from the (now closed) new-domain-sites project.

## Architecture

- **App**: `apps/forzamonica.com` — TanStack Start (React 19), PandaCSS + Ark UI, deployed with
  plain `wrangler deploy` via `@cloudflare/vite-plugin` (deliberately not Alchemy while f311x shakes
  out).
- **Shopify**: all Storefront API calls go through TanStack Start server functions
  (`src/lib/shopify/`), so access tokens stay server-side. Cart ID lives in an httpOnly cookie.
  Checkout redirects to the cart's `checkoutUrl` (Shopify-hosted).
- **mock.shop first**: the storefront is fully wired against [mock.shop](https://mock.shop),
  Shopify's hosted mock Storefront API. Catalog, product pages, and cart work end-to-end with zero
  credentials. Cutover to the real store is config-only: `SHOPIFY_STOREFRONT_API_URL` var +
  `SHOPIFY_STOREFRONT_PUBLIC_TOKEN` secret.
- **Repo firsts**: this app establishes the Ark UI + PandaCSS pattern (slot recipes in
  `panda.config.ts`; `QuantityField` is the reference component) and the TanStack Start +
  wrangler-deploy combination (f311x uses Alchemy).

## Phases

### Phase 1 — Scaffold (done 2026-06-11)

- [x] App scaffold with repo-standard toolchain (tsgo, Biome+Oxlint, Vitest, mise tasks)
- [x] Catalog, product detail, and cart routes working against mock.shop (verified end to end,
      including cart mutations)
- [x] CI (`ci-forzamonica-com.yml`) and CD (`cd-deploy-forzamonica-com.yml`) workflows

### Phase 2 — Accounts & plumbing (human)

- [x] Cloudflare deploys use the shared `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
      like the other apps (decided 2026-06-12); no per-app secrets
- [ ] Shopify store + Headless channel + Storefront API token
      ([#222](https://github.com/davidjfelix/davidjfelix/issues/222))
- [x] Register forzamonica.com and add the zone to the account (#223, closed 2026-06-14; David
      reports the domain is attached — the commented `routes` block in `wrangler.toml` still needs
      reconciling with however it was attached)
- [ ] First production deploy on merge to main

### Phase 3 — Real store cutover

- [ ] Point `SHOPIFY_STOREFRONT_API_URL` at the real store; set token secret
- [ ] Real products, collections as needed
- [ ] Brand/theme pass (tokens in `panda.config.ts` are placeholder red/neutral)

### Phase 4 — Polish & instrumentation

- [x] Sentry + PostHog per the cross-app instrumentation projects (wired 2026-06-25; dark until
      #261)
- [x] Per-PR preview + Playwright e2e (#300) — forzamonica was the last wrangler app without them
- [x] Site map + shared layout (2026-07-02): about page, policy stubs, styled 404, footer, header
      cart badge, per-page titles, e2e for all of it. Catalog kept flat — collections routes
      deferred until the real product line exists.
- [ ] Extend e2e beyond the home hero to catalog → cart (mock.shop makes this straightforward)
- [ ] Collections, search, richer PDP as the catalog warrants

## Links

- App: [`apps/forzamonica.com`](../../../apps/forzamonica.com/)
- new-domain-sites — the originating line item (project closed; recorded in the
  [changelog](../../changelog/2026-06.md))
- preview deployments — the per-PR preview/smoke/screenshot bar this app adopts (shipped repo-wide
  2026-06-17; see the changelog)
