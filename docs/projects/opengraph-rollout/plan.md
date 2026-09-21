# OpenGraph Rollout

## Status

**Draft** (2026-09-20) -- inventory complete; the plan below awaits David's answers to the open
decisions before any code changes. No app has changed yet.

## Goal

Every public app renders a real share card when its URL is pasted into Slack, iMessage, X, LinkedIn,
Bluesky, or Discord: a 1200x630 image, a title, a description, and a canonical URL, all served from
the app's own origin. djf.io is the bar. `@davidjfelix/og` (`workspaces/web-apps/packages/og`) is
the mechanism, and it is already a dependency of every app.

## Where each app stands (2026-09-20 inventory)

Every app already calls `ogTags` from `@davidjfelix/og` (the 2026-08 extraction wired it in). What
differs is which fields each app passes. Scrapers care about four things: an absolute 1200x630
`og:image`, `og:title` + `og:description`, `og:url`, and `twitter:card` (X only picks the
large-image layout when it is set).

| App                  | Stack                                 | Emits today                                                                                                                                                      | Missing for a real card                                                                | Notes                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| djf.io               | Astro                                 | title, description, type, site_name, locale, url, image (+width/height/alt), article:\*, twitter card/site/creator, canonical; per-post generated cards; seo e2e | --                                                                                     | The reference. `src/pages/og/[...slug].png.ts` prerenders one card per post plus a default.                                                                                                                                                                                      |
| davidjfelix.com      | Astro                                 | title, description, type, site_name                                                                                                                              | url, image, twitter card, locale, canonical                                            | `site` is already set in `astro.config.mjs`, so absolute URLs are free.                                                                                                                                                                                                          |
| ravrun               | TanStack Start, SPA shell prerendered | title, description, type, site_name                                                                                                                              | image, twitter card                                                                    | SPA mode: only the prerendered shell's tags reach scrapers; per-route `head()` is client-only. `og:url`/canonical in the shell would claim `/` on every path, so they stay off. Two domains (ravrun.com, rav.run): one must be the image origin. `/about` has no title override. |
| monicandavid.com     | SvelteKit                             | title, description, type, site_name (home only)                                                                                                                  | url, image, twitter card, locale, canonical                                            | `/admin` is gated; no tags needed there.                                                                                                                                                                                                                                         |
| pkg.dog              | Nuxt                                  | title, description, type, site_name                                                                                                                              | url, image, twitter card, locale, canonical                                            | Four hostnames route here (pkg.dog, pkgdog.com, www of each); pkg.dog is canonical.                                                                                                                                                                                              |
| forzamonica.com      | TanStack Start                        | root defaults; eight routes override title                                                                                                                       | url, image, twitter card, locale, canonical                                            | Product routes already load Shopify's `featuredImage` into `loaderData`: a per-product `og:image` is a one-line follow-up, and works against mock.shop today.                                                                                                                    |
| revision.city        | TanStack Start                        | root title and description are the placeholder string "revision.city"; `/` overrides description; `/diffs` overrides title + description                         | real root description, url, image, twitter card, canonical                             |                                                                                                                                                                                                                                                                                  |
| startchi.com         | TanStack Start                        | title, description "startchi.com" (placeholder), type, site_name                                                                                                 | real description, url, image, twitter card, canonical                                  |                                                                                                                                                                                                                                                                                  |
| f311x                | TanStack Start                        | title, type, site_name                                                                                                                                           | description, url, image, twitter card, canonical                                       | Will move behind auth; the landing page is what gets shared.                                                                                                                                                                                                                     |
| calendar-visualizer  | Astro                                 | title, type                                                                                                                                                      | description (there is no meta description either), site_name, url, image, twitter card | Intentionally on workers.dev until the product is defined; the repo holds no canonical origin for it, so absolute image/url tags cannot be built yet.                                                                                                                            |
| onvibes.org          | TanStack Start                        | title, description, type, site_name                                                                                                                              | -- (moot)                                                                              | Behind Cloudflare Access: scrapers get the login redirect, never the page.                                                                                                                                                                                                       |
| alchemy-state-viewer | SvelteKit                             | title, type (home only)                                                                                                                                          | -- (moot)                                                                              | Behind Cloudflare Access; same.                                                                                                                                                                                                                                                  |

In short: outside djf.io, no app emits `og:image`, `og:url`, or `twitter:card`, none has a
`<link rel="canonical">`, and no static social image exists anywhere. Two apps ship their domain
name as their description. The tag builder is solved; the image and the absolute URLs are the gap.

## The contract

What every public app emits once this lands (djf.io already does):

1. `og:title`, `og:description`, `og:type=website`, `og:site_name`, `og:locale=en_US`.
2. `og:url` plus `<link rel="canonical">`, absolute, on the app's canonical domain. Skipped only
   where the document cannot know its own path (ravrun's prerendered SPA shell).
3. `og:image`, absolute on the same origin, 1200x630, with `og:image:width`, `og:image:height`, and
   `og:image:alt`; `twitter:image` mirrors it (the builder already does this).
4. `twitter:card=summary_large_image`; `twitter:site`/`twitter:creator` only on David's own sites.
5. A real description: no app ships its domain name as its description.
6. Per-route overrides (forzamonica.com's titled routes, revision.city's `/diffs`) keep composing
   through head merging; a route passes only the fields that differ.
7. Each app's e2e suite asserts the tags on the home page and fetches `og:image`, checking the PNG
   header for 1200x630 -- djf.io's `src/seo.e2e.test.ts` pattern.

## Mechanism

Three package changes, then per-app wiring.

1. **`ogSite` helper** on the package root. Takes
   `{origin, siteName, title, description, path?, twitter?}` and returns the full `OgParams`: `url`
   from origin + path, `image` = `${origin}/og/default.png` with `ogImageSize` and a "Title card for
   <siteName>" alt, `locale`, and `twitter.card`. Apps call `ogTags(ogSite({...}))`; djf.io keeps
   its explicit call. (Decision 1: helper vs. inlining the four fields in eleven call sites.)
2. **Card theming in `renderOgImage`**: an optional `theme` param
   (`{background, foreground, muted, accent: [from, to]}`) defaulting to today's zinc/blue-violet
   djf.io look, so djf.io's output stays byte-identical (its contract tests prove it). Fonts stay
   Inter for v1; per-app brand fonts are a follow-up.
3. **A build-time card generator**: `packages/og/bin/render-card.ts`, exposed as the workspace bin
   `og-card`. It reads the app's `og.config.ts` (`{siteName, title, description, theme?, out}`) and
   writes `public/og/default.png` (`static/og/` for SvelteKit). Each single-card app runs it first
   in `build` (`"build": "og-card && vite build"`). The PNG is gitignored and rides into `dist/`,
   `.output/`, or `.svelte-kit/` through the framework's static copy, which turbo's `build.outputs`
   already covers. satori, sharp, and `@fontsource/inter` resolve from `packages/og`'s own tree
   because the script lives there, so no app adds the three dependencies (the isolated-linker trap
   the package README records). djf.io keeps its prerendered endpoint because it needs one card per
   post.

Alternatives considered: committing a PNG per app (binaries in the repo, which the package
extraction deliberately avoided), and runtime rendering on Workers with satori + resvg-wasm (only
needed for dynamic cards; see Phase 3).

## Phases

1. **Package** -- `ogSite`, card theming, the `og-card` bin, and a `pngSize` helper on a `./png`
   subpath (djf.io carries two copies today, in `src/seo.e2e.test.ts` and
   `src/pages/og/_og-routes.test.ts`), each with unit tests. davidjfelix.com is wired as the first
   consumer to prove the generator end to end (Astro, `site` already set). One PR.
2. **Public apps** -- ravrun, monicandavid.com, pkg.dog, forzamonica.com, revision.city,
   startchi.com, f311x: an origin constant, the `ogSite` call, `og.config.ts` + the build hook, the
   canonical link, real descriptions, and one e2e case each. Grouped by framework for review
   (TanStack x5, SvelteKit, Nuxt) or one PR per app under the affected-driven CI (Decision 6).
3. **Dynamic cards** -- follow-ups, each its own project when the app is ready:
   - forzamonica.com: per-product `og:image` from `featuredImage` (small enough to ride Phase 2).
   - ravrun: shared-plan cards. Needs server rendering (a Worker `/og/*.png` route with satori +
     resvg-wasm) because plans are URL state and the SPA shell is static.
   - revision.city: per-diff cards under `/diffs`.
   - monicandavid.com: per-post cards once posts exist, on djf.io's pattern.
4. **Deferred** -- calendar-visualizer gets description, site_name, and the twitter card now (cheap,
   no origin needed) and the image once it has a domain. onvibes.org and alchemy-state-viewer stay
   as they are until they leave Cloudflare Access.

## Open decisions

1. `ogSite` helper (recommended) vs. inlining url/image/locale/twitter in eleven call sites.
2. One shared card template with per-app colors (recommended for v1) vs. bespoke cards per app.
3. Build-time generated PNG, gitignored (recommended) vs. committed PNGs vs. runtime rendering.
4. Descriptions -- drafts that need David's edit:
   - startchi.com: "The Chicago and Midwest startup ecosystem: a directory, signal boost, and org
     hub."
   - revision.city (root): "Version control, centered on review." (already on `/`)
   - f311x: "A small chat playground on Cloudflare."
   - calendar-visualizer: "A full-year calendar that overlays weekends, holidays, and your own
     phases."
5. ravrun's canonical origin: ravrun.com or rav.run. And which apps carry `twitter:site`
   `@davidjfelix` (djf.io has it; davidjfelix.com and ravrun are the candidates).
6. PR shape for Phase 2: per framework or per app.
7. Card colors per app: pulled from each app's Panda/Tailwind tokens (forzamonica.com's paper tones,
   and so on), or the shared zinc card everywhere first and tuned later.

## Links

- Package: [`workspaces/web-apps/packages/og/`](../../../workspaces/web-apps/packages/og/README.md)
  -- per-framework usage and the peer-dependency trap
- Reference implementation: `workspaces/web-apps/apps/djf.io/src/layouts/BaseLayout.astro`,
  `src/pages/og/[...slug].png.ts`, `src/seo.e2e.test.ts`
- Extraction record: [`docs/changelog/2026-08.md`](../../changelog/2026-08.md), "feat(og): extract
  the OpenGraph integration into @davidjfelix/og and wire it into every app"
