# 2026-04-29 — Phase 2: Vitest unit tests

## Done

- Added `vitest@3` to `apps/djf.io` devDeps
- `vitest.config.ts` using Astro's `getViteConfig` so tests can import `astro:content` virtuals and `.astro` components directly
  - `include: ['src/**/*.test.ts']`, `exclude: ['**/*.e2e.test.ts']` — Vitest and Playwright disjoint by suffix
- `package.json` scripts: `test:unit`, `test:unit:watch`; `test` now runs unit then e2e
- `src/content/config.test.ts` — content schema unit tests:
  - accepts minimal valid frontmatter
  - coerces ISO date strings to `Date` (`z.coerce.date`)
  - rejects missing required fields
  - rejects unparseable date values
  - accepts optional tags / aiAssistants shapes
  - rejects malformed aiAssistants entries
- `src/layouts/BaseLayout.test.ts` — uses `experimental_AstroContainer`:
  - title prop is suffixed with site name
  - provided / default description in `<meta>`
  - nav renders home / blog / GitHub / Twitter links
  - default slot renders inside `<main>`
  - footer contains current year
- `src/layouts/BlogPost.test.ts` — uses `experimental_AstroContainer`:
  - H1 contains post title
  - date formatted in long form (`December 7, 2025`)
  - optional author / reading time fields render only when provided
  - tags render as links to `/blog/tags/<tag>`
  - default slot renders post body
  - title and description pass through to `BaseLayout`
- `.github/workflows/djf-io-ci.yml`: added `unit` job (mise install + `pnpm test:unit`)

## Validated locally

- `pnpm build`, `pnpm test:unit`, `pnpm test:e2e` all green
- Unit: 21 tests across 3 files, ~2s
- E2E: 7 tests, ~13s
- `npx @biomejs/biome@2 check .` exit 0; `npx oxlint@1 .` exit 0

## Decisions

- **Astro `getViteConfig`** over a hand-rolled vitest config: lets tests import `astro:content` and `.astro` files without having to mock the Astro runtime.
- **Container API for component tests**: faster than spinning a browser, and the layout/blog-post components are pure-rendered (no client JS). E2E still owns full-page integration; unit tests own component contracts.
- **Schema test pattern**: invoke `collections.blog.schema({image: () => z.any()})` to materialize the zod schema for assertions, instead of refactoring the schema out of `config.ts` for testability.
- **Disjoint test suffixes**: `.test.ts` for unit, `.e2e.test.ts` for e2e, with explicit Vitest `exclude` of `.e2e.test.ts` so the two runners don't collide.
- **Flat test files, no `describe`** (per [Avoid Nesting When You're Testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing)): every `test(...)` is top-level, with the component or subject in the test name (`'BlogPost renders post title as H1'`) instead of as a `describe` group. Recorded in `CLAUDE.md` so it sticks across sessions.
- **No `before*`/`after*` hooks**: container instances are created with top-level `await`, and per-test fixtures use a small named factory called inline. Hooks hide control flow.
- **Local-time fixture dates**: `new Date(2025, 11, 7)` instead of `new Date('2025-12-07')`. The string form parses as UTC midnight and `toLocaleDateString` then renders in the local zone, which silently fails for any developer west of UTC. Verified with `TZ=America/Los_Angeles pnpm test:unit`.

## Notes for future tests

- New utility / lib code: drop `xxx.test.ts` next to it, no extra config
- New `.astro` components: add `xxx.test.ts` next to it; reuse the `experimental_AstroContainer` pattern
- For pages, prefer `_xxx.e2e.test.ts` (Playwright) since rendering them in isolation requires more fixturing than the smoke-level coverage warrants today
