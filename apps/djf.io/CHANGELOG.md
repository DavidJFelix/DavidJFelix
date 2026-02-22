# Changelog

## 2026-02-22

### Fixed

- Fixed Vercel build by adding `bun.lock` — Vercel was running `bun install --frozen-lockfile` but only a `pnpm-lock.yaml` existed, causing bun's lockfile migration to fail in frozen mode
- Removed `"packageManager": "pnpm@10.0.0"` field that conflicted with bun usage on Vercel
- Fixed build script to run `panda codegen` before `astro build` so generated styles are available at build time

### Changed

- Consolidated dev tooling (Biome, Oxlint, Prettier) to root-level mise config
- Upgraded Biome 2.0 to 2.4, Oxlint 0.16 to 1.x

## 2026-02-06

### Added

- Tag listing page at `/blog/tags/`
- Tag archive pages at `/blog/tags/[tag]`
- RSS feed support at `/rss.xml`

### Fixed

- Fixed nested anchor tags on blog index page

## 2026-01-13

### Changed

- Replaced Starlight with custom Astro + PandaCSS blog layouts
- Switched to default PandaCSS preset, removed Park UI
- Created BaseLayout and BlogPost layout components
- Migrated blog content from `src/content/docs/blog/` to `src/content/blog/`
- Dark theme with zinc color palette
- Set up PandaCSS with responsive navigation and styled blog post typography

### Added

- Home page with bio, career history, AI disclaimer
- Blog index page with posts sorted by date
- Dynamic blog post routes via `[...slug]`
