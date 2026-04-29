# djf.io Testing

## Goal

Set up automated testing for djf.io with CI gating.

## Scope

- Vitest for unit tests where necessary
- Playwright for E2E tests where necessary
- CI pipeline gates merges on test results

## Status

- [x] Phase 1: Playwright + CI gating (lint, build, E2E)
- [x] Phase 2: Vitest unit tests (content schema + components via `experimental_AstroContainer`)

## Working Notes

### Playwright (current)

Configured via `apps/djf.io/playwright.config.ts`:

- Single Chromium project, `webServer` runs `astro preview` on `127.0.0.1:4321`
- `testMatch: '**/*.e2e.test.ts'`, `testDir: './src'` — tests are co-located next to the source they exercise
- HTML + GitHub reporters in CI; `list` locally
- `retries: 2` and `workers: 1` in CI for stability

Co-located smoke coverage:

- `src/pages/_index.e2e.test.ts` — landing renders, blog link navigates
- `src/pages/blog/_index.e2e.test.ts` — index ordering
- `src/pages/blog/_[...slug].e2e.test.ts` — MDX post body + headings
- `src/pages/blog/tags/_index.e2e.test.ts` — tags index
- `src/pages/blog/tags/_[tag].e2e.test.ts` — tag filter
- `src/pages/_rss.xml.e2e.test.ts` — RSS feed XML

Scripts: `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:ui`.

#### Naming convention

- Unit tests: `xxx.test.ts` next to `xxx.ts`
- E2E tests: `xxx.e2e.test.ts` next to `xxx.astro` / `xxx.ts`
- Files in `src/pages/` carry a leading `_` (e.g. `_index.e2e.test.ts`) — Astro's filesystem router treats every `.ts` in `src/pages/` as an endpoint, and the underscore prefix is its built-in escape hatch (Astro skips any file whose name starts with `_`). Outside `src/pages/`, no prefix is needed.

### Vitest

Configured via `apps/djf.io/vitest.config.ts` using Astro's `getViteConfig` so tests can import `astro:content`, `astro:assets`, and `.astro` components directly.

- `include: ['src/**/*.test.ts']`, `exclude: ['**/*.e2e.test.ts']` so Vitest and Playwright don't fight over files
- Component tests use `experimental_AstroContainer` from `astro/container` — renders `.astro` components to HTML strings without a browser

Coverage:

- `src/content/config.test.ts` — content collection schema: required fields, date coercion, optional `tags`/`aiAssistants` shape
- `src/layouts/BaseLayout.test.ts` — title/description meta, default description fallback, nav links, slot, year in footer
- `src/layouts/BlogPost.test.ts` — H1 title, formatted date, optional author/readingTime, tag links, slot, prop pass-through to `BaseLayout`

Scripts: `pnpm test:unit`, `pnpm test:unit:watch`. `pnpm test` now runs unit then e2e.

### CI

`.github/workflows/djf-io-ci.yml` — path-filtered to `apps/djf.io/**` and shared config.

- `lint-and-build` job: mise install, `pnpm lint`, `pnpm build`
- `unit` job: mise install, `pnpm test:unit`
- `e2e` job: mise install, Playwright browsers (cached by version), build, `pnpm test:e2e`, upload `playwright-report/` artifact

## Related

- [Blog Migration](../blog-migration/plan.md) — Phase 8 originally tracked this; moving to its own project
- App location: `apps/djf.io/`
