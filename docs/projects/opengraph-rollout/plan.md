# OpenGraph Rollout

## Status

**Active** (2026-09-21) -- implemented on one branch after the 2026-09-20 inventory and David's
decisions below: every public app now serves a share card rendered at request time on its Worker,
with `og:url`, a canonical link, and the large-image twitter card. Close into the changelog once the
PR merges and the first production deploy confirms the cards render within the Workers plan's CPU
budget (see "Risks"). The dynamic-card follow-ups below stay open as their own efforts.

## Goal

Every public app renders a real share card when its URL is pasted into Slack, iMessage, X, LinkedIn,
Bluesky, or Discord: a 1200x630 image, a title, a description, and a canonical URL, all served from
the app's own origin. djf.io is the bar. `@davidjfelix/og` (`workspaces/web-apps/packages/og`) is
the mechanism, and it is already a dependency of every app.

## Where each app stood (2026-09-20 inventory)

Every app already called `ogTags` from `@davidjfelix/og` (the 2026-08 extraction wired it in). What
differed was which fields each app passed. Scrapers care about four things: an absolute 1200x630
`og:image`, `og:title` + `og:description`, `og:url`, and `twitter:card` (X only picks the
large-image layout when it is set).

| App                  | Stack                                 | Emitted before                                                                                                                                                   | Was missing for a real card                                                            | Notes                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| djf.io               | Astro                                 | title, description, type, site_name, locale, url, image (+width/height/alt), article:\*, twitter card/site/creator, canonical; per-post generated cards; seo e2e | --                                                                                     | The reference. `src/pages/og/[...slug].png.ts` prerenders one card per post plus a default.                                                                                                                                                                                      |
| davidjfelix.com      | Astro                                 | title, description, type, site_name                                                                                                                              | url, image, twitter card, locale, canonical                                            | `site` is already set in `astro.config.mjs`, so absolute URLs are free.                                                                                                                                                                                                          |
| ravrun               | TanStack Start, SPA shell prerendered | title, description, type, site_name                                                                                                                              | image, twitter card                                                                    | SPA mode: only the prerendered shell's tags reach scrapers; per-route `head()` is client-only. `og:url`/canonical in the shell would claim `/` on every path, so they stay off. Two domains (ravrun.com, rav.run): one must be the image origin. `/about` has no title override. |
| monicandavid.com     | SvelteKit                             | title, description, type, site_name (home only)                                                                                                                  | url, image, twitter card, locale, canonical                                            | `/admin` is gated; no tags needed there.                                                                                                                                                                                                                                         |
| pkg.dog              | Nuxt                                  | title, description, type, site_name                                                                                                                              | url, image, twitter card, locale, canonical                                            | Four hostnames route here (pkg.dog, pkgdog.com, www of each); pkg.dog is canonical.                                                                                                                                                                                              |
| forzamonica.com      | TanStack Start                        | root defaults; eight routes override title                                                                                                                       | url, image, twitter card, locale, canonical                                            | Product routes already load Shopify's `featuredImage` into `loaderData`: a per-product `og:image` is a one-line follow-up, and works against mock.shop today.                                                                                                                    |
| revision.city        | TanStack Start                        | root title and description are the placeholder string "revision.city"; `/` overrides description; `/diffs` overrides title + description                         | real root description, url, image, twitter card, canonical                             |                                                                                                                                                                                                                                                                                  |
| startchi.com         | TanStack Start                        | title, description "startchi.com" (placeholder), type, site_name                                                                                                 | real description, url, image, twitter card, canonical                                  |                                                                                                                                                                                                                                                                                  |
| f311x                | TanStack Start                        | title, type, site_name                                                                                                                                           | description, url, image, twitter card, canonical                                       | Will move behind auth; the landing page is what gets shared. Deploys through alchemy without the Cloudflare Vite plugin.                                                                                                                                                         |
| calendar-visualizer  | Astro                                 | title, type                                                                                                                                                      | description (there is no meta description either), site_name, url, image, twitter card | Intentionally on workers.dev until the product is defined; the repo holds no canonical origin for it, so absolute image/url tags cannot be built yet.                                                                                                                            |
| onvibes.org          | TanStack Start                        | title, description, type, site_name                                                                                                                              | -- (moot)                                                                              | Behind Cloudflare Access: scrapers get the login redirect, never the page.                                                                                                                                                                                                       |
| alchemy-state-viewer | SvelteKit                             | title, type (home only)                                                                                                                                          | -- (moot)                                                                              | Behind Cloudflare Access; same.                                                                                                                                                                                                                                                  |

In short: outside djf.io, no app emitted `og:image`, `og:url`, or `twitter:card`, none had a
`<link rel="canonical">`, and no static social image existed anywhere. Two apps shipped their domain
name as their description. The tag builder was solved; the image and the absolute URLs were the gap.

## Decisions (David, 2026-09-21)

1. A site-level helper in the package where possible; an app that needs its own parameters spreads
   over it.
2. One shared card template for now; per-app customization later.
3. Cards render at **request time** on the Worker, not at build and not as committed PNGs.
4. Descriptions: the drafts below stand until edited.
5. ravrun's canonical origin is ravrun.com.
6. No twitter handle on the new sites; djf.io keeps its `@davidjfelix`.
7. Everything lands in one PR.
8. Card colors come from each app's design tokens.

## The contract

What every public app emits (djf.io already did):

1. `og:title`, `og:description`, `og:type=website`, `og:site_name`, `og:locale=en_US`.
2. `og:url` plus `<link rel="canonical">`, absolute, on the app's canonical domain, naming the
   requested page (TanStack roots read the path off the leaf match; Astro, SvelteKit, and Nuxt read
   their own URL). Skipped only where the document cannot know its own path (ravrun's prerendered
   SPA shell).
3. `og:image`, absolute on the same origin, 1200x630, with `og:image:width`, `og:image:height`, and
   `og:image:alt`; `twitter:image` mirrors it.
4. `twitter:card=summary_large_image` wherever a card exists; `summary` where none does.
5. A real description: no app ships its domain name as its description.
6. Per-route overrides (forzamonica.com's titled routes, revision.city's `/diffs`) keep composing
   through head merging; a route passes only the fields that differ.
7. Each app's e2e suite asserts the tags on the home page and fetches `og:image` from the local
   workerd boot, checking the PNG header for 1200x630 -- djf.io's `src/seo.e2e.test.ts` pattern.

## Mechanism

The package renders on WebAssembly everywhere, and each framework only decides how the binaries
reach it. `packages/og/README.md` is the reference; the shape:

- **`ogSite`** on the package root takes
  `{origin, siteName, title, description, path?, image?, twitter?}` and returns the full `OgParams`
  (absolute url and image with the shared size and alt text, locale, the large-image card). Apps
  call `ogTags(ogSite({...site, path}))` from a per-app `site.ts` that also carries the card theme.
- **`createOgRenderer(runtime)`** on `./image` draws the card with satori (standalone build, Yoga
  handed in as a module) and rasterizes it with `@resvg/resvg-wasm`; `sharp` is gone from the
  package. `OgTheme` is `{background, foreground, muted, accent?}`, defaulting to djf.io's card.
- **`ogCard`** on `./card` is the `/og/default.png` handler: it renders once and keeps the response
  in the Workers Cache API's default cache, so a burst of scrapers rasterizes once per edge
  location.
- **Runtimes** load the two wasm binaries and the Inter files: `./runtime/vite` (`.wasm` imports the
  Cloudflare Vite plugin turns into uploaded modules, `?inline` fonts), `./runtime/nitro` (unwasm's
  `?module`, Nitro's `raw:`), `./runtime/node` (disk reads, for djf.io's prerender and the tests).
  Resolution starts inside the package, so no app declares satori, resvg, or the fonts; djf.io is
  the exception because its Node prerender externalizes them.
- **Per framework**: TanStack Start apps mount a server route at `og/default[.]png.ts`; Astro an
  on-demand endpoint (`prerender = false`); SvelteKit a `+server.ts` that loads the runtime on the
  first request (its build imports every route module in Node to read page options) behind a small
  Vite plugin that leaves `.wasm` imports for wrangler's bundler; Nuxt a Nitro route behind
  `nitro.experimental.wasm`.
- **satori is held at 0.32** (`.github/renovate.json`): 0.33's HarfBuzz shaper cannot load on
  Workers (it reads `self.location` and compiles wasm from bytes).
- **Preview builds carry their own origin.** The absolute tags are baked at build, so
  `.depot/actions/preview-wrangler` resolves the deterministic `pr-<N>` alias URL ahead of the build
  (`bin/preview-url.ts` reads the account's workers.dev subdomain from the Cloudflare API) and hands
  it to the build as `PUBLIC_SITE_URL`, `VITE_PUBLIC_SITE_URL`, and `NUXT_PUBLIC_SITE_URL`; each
  app's `site.origin` prefers it over the canonical origin, and each e2e expects the `PREVIEW_URL`
  origin when it runs against a preview. Production builds set nothing and keep the canonical
  origin. f311x's alchemy preview learns its URL only after deploying, so its tags keep naming
  production (it has no card anyway).

## What landed

- Package: `ogSite`, the portable renderer with themes, `ogCard`, the three runtimes with consumer
  type surfaces, `pngSize` on `./png`, a Vitest plugin that stands in for the bundlers so every
  runtime renders a real card in the suite, 100% coverage.
- djf.io: same prerendered endpoint and cards, now on the wasm rasterizer (`sharp` stays only for
  astro:assets); its seo e2e and og route contract tests are the proof.
- Cards + full tags + canonical + e2e: startchi.com, davidjfelix.com, monicandavid.com, ravrun (no
  og:url, per the SPA shell), revision.city, forzamonica.com (product pages also offer the product
  photo as the card), pkg.dog.
- Tags only: f311x (deploys through alchemy without the Cloudflare Vite plugin, so no wasm module
  rule to ride; `summary` card, no image) and calendar-visualizer (no canonical origin yet).
- Unchanged: onvibes.org and alchemy-state-viewer, behind Cloudflare Access.

## Risks

- **Workers CPU budget.** A cold render (wasm instantiation plus satori and resvg) took about a
  second of wall time under miniflare; a cached repeat takes milliseconds. The Workers free plan
  caps CPU at 10 ms per request and would kill the first render; the paid plan does not. Confirm the
  account's plan on the first production deploy by fetching one `/og/default.png` cold. If it is the
  free plan, the fallback is to prerender the default card at build the way djf.io does.
- **satori pinned at 0.32** until upstream's standalone init accepts the HarfBuzz module; the
  Renovate rule documents it and every app's e2e would catch a bad bump.

## Follow-ups (each its own effort)

- ravrun: shared-plan cards once URL state ships (a parameterized `/og/*.png` route on the same
  runtime).
- revision.city: per-diff cards under `/diffs`.
- monicandavid.com: per-post cards once posts exist, on djf.io's pattern.
- calendar-visualizer: `og:url` and the card once it has a domain.
- f311x: a card once its deploy pipeline carries a wasm module rule (or it moves to the Cloudflare
  Vite plugin).
- Per-app card customization (brand fonts, layouts) beyond the shared template.

## Links

- Package: [`workspaces/web-apps/packages/og/`](../../../workspaces/web-apps/packages/og/README.md)
- Reference implementations: `workspaces/web-apps/apps/startchi.com` (TanStack Start),
  `workspaces/web-apps/apps/davidjfelix.com` (Astro), `workspaces/web-apps/apps/monicandavid.com`
  (SvelteKit), `workspaces/web-apps/apps/pkg.dog` (Nuxt),
  `workspaces/web-apps/apps/djf.io/src/pages/og/[...slug].png.ts` (prerendered per-post cards)
- Extraction record: [`docs/changelog/2026-08.md`](../../changelog/2026-08.md), "feat(og): extract
  the OpenGraph integration into @davidjfelix/og and wire it into every app"
