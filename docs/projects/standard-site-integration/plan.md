# Standard.site Integration

## Goal

Integrate [standard.site](https://standard.site/) lexicons into djf.io so blog posts are discoverable and portable across the AT Protocol ecosystem. This makes the blog interoperable with other ATmosphere publishing tools and indexers.

## Background

standard.site defines three AT Protocol lexicons for long-form publishing:

- `site.standard.publication` — represents the blog as a whole
- `site.standard.document` — represents individual blog posts
- `site.standard.graph.subscription` — follows/subscriptions

## Implementation

### Phase 1: Verification endpoints (complete)

- `/.well-known/site.standard.publication` endpoint returning publication AT-URI
- `<link rel="site.standard.document">` tags in blog post `<head>`
- `atUri` field in blog content schema for storing document record references
- Config module at `src/standard-site.ts` with DID and helpers

### Phase 2: Sync script (complete)

- `scripts/standard-site-sync.ts` — syncs blog posts to PDS as `site.standard.document` records
- Creates/updates `site.standard.publication` record
- Writes `atUri` back to post frontmatter after sync
- Run via `pnpm sync:standard-site` (requires `BSKY_HANDLE` and `BSKY_APP_PASSWORD`)

### Phase 3: Future enhancements

- Automate sync in CI/CD pipeline on deploy
- Add `site.standard.graph.subscription` support
- Add `basicTheme` to publication record
- Consider `coverImage` and `updatedAt` on document records

## Key Files

- `apps/djf.io/src/standard-site.ts` — DID and AT-URI config
- `apps/djf.io/src/pages/.well-known/site.standard.publication.ts` — verification endpoint
- `apps/djf.io/src/layouts/BlogPost.astro` — document link tag
- `apps/djf.io/src/layouts/BaseLayout.astro` — head slot for link tags
- `apps/djf.io/src/content/config.ts` — content schema with `atUri` field
- `apps/djf.io/scripts/standard-site-sync.ts` — sync script

## References

- [standard.site](https://standard.site/)
- [standard.site quick start](https://standard.site/docs/quick-start/)
- [standard.site verification](https://standard.site/docs/verification/)
