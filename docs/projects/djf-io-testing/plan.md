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
- HTML + GitHub reporters in CI; `list` locally
- `retries: 2` and `workers: 1` in CI for stability

Smoke coverage in `apps/djf.io/tests/e2e/`:

- `home.spec.ts` — landing renders, blog link navigates
- `blog.spec.ts` — index ordering, MDX post rendering, tags index, tag filter
- `rss.spec.ts` — RSS feed responds with valid XML and post entries

Scripts: `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:ui`.

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
