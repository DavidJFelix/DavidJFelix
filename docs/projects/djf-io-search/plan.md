# djf.io Search

## Goal

Add static, build-time search to djf.io using Pagefind.

## Rationale

- Same engine Starlight used; framework-agnostic
- Indexes at build time -- no server, ~5kb runtime
- Supports filtering by tag/date

## Implementation

- [ ] Install `pagefind` in `apps/djf.io`
- [ ] Configure Pagefind to index at build time (post-build hook)
- [ ] Build a search UI component styled with PandaCSS
- [ ] Wire into `BaseLayout` nav with a Cmd/Ctrl+K shortcut
- [ ] E2E test: search finds posts by title and body

## Files

- `apps/djf.io/astro.config.mjs` -- post-build Pagefind hook
- `apps/djf.io/src/components/Search.*` -- UI
- `apps/djf.io/src/layouts/BaseLayout.astro` -- trigger integration
