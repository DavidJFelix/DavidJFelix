# djf.io Testing

## Goal

Set up automated testing for djf.io with CI gating.

## Scope

- Vitest for unit tests where necessary
- Playwright for E2E tests where necessary
- CI pipeline gates merges on test results

## Status

- [x] Phase 1: Playwright + CI gating (lint, build, E2E)
- [ ] Phase 2: Vitest — deferred until shared/library logic exists worth unit-testing

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

### Vitest (deferred)

The current djf.io codebase is mostly Astro components and content; there's no shared util/lib code where Vitest would add value today. Adding it would mean either testing trivial helpers we don't have, or fabricating helpers solely to test. Revisit when:

- A util/lib module appears (date helpers, content transforms, etc.)
- Or React component logic becomes non-trivial enough to test in isolation

### CI

`.github/workflows/djf-io-ci.yml` — path-filtered to `apps/djf.io/**` and shared config.

- `lint-and-build` job: mise install, `pnpm lint`, `pnpm build`
- `e2e` job: mise install, Playwright browsers (cached by version), build, `pnpm test:e2e`, upload `playwright-report/` artifact

## Related

- [Blog Migration](../blog-migration/plan.md) — Phase 8 originally tracked this; moving to its own project
- App location: `apps/djf.io/`
