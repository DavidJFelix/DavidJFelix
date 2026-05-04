# djf.io SEO & Polish

## Goal

Bring djf.io to production polish: SEO meta, Open Graph images, sitemap, Lighthouse >90.

## Implementation

- [ ] SEO meta tags (title, description, canonical) on every page
- [ ] Open Graph + Twitter card meta; per-post OG images (generated at build time)
- [ ] Sitemap via `@astrojs/sitemap`
- [ ] JSON-LD structured data for blog posts (Article schema)
- [ ] Lighthouse audit; address regressions until perf/SEO/a11y >90
- [ ] E2E assertion: every page has title + description + canonical

## Files

- `apps/djf.io/astro.config.mjs` -- sitemap integration, site URL
- `apps/djf.io/src/layouts/BaseLayout.astro` -- meta, OG, JSON-LD
- `apps/djf.io/src/pages/og/[...slug].png.ts` -- OG image generation (or similar)
