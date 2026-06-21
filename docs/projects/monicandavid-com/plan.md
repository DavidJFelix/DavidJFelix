# monicandavid.com (Monica & David)

A couple's blog for Monica & David — their shared corner of the web.

## Status

**Placeholder — basic layout shipped** (2026-06-19). Live at monicandavid.com; SvelteKit and
PandaCSS. The landing now reads as a couple's blog; the actual posts are the next phase.

## Vision

A shared, low-key personal blog for Monica & David as a couple — writing about their life together.
Small and personal by design: not a wedding/event site, not a business. When the real blog is built,
mirror djf.io's content approach (a content collection of markdown posts), adapted to SvelteKit.

## Current state (2026-06-19)

- Live at monicandavid.com (SvelteKit on Cloudflare; custom domain + www wired).
- `src/routes/+page.svelte` is a real basic landing — header, an "Our blog" hero, footer (Panda
  `css()`). Copy reads as a couple's blog ("Posts coming soon"). No posts yet.

## Stack

SvelteKit and PandaCSS, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout

- [x] Confirm the site's purpose with David. (2026-06-19 — a couple's blog)
- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)

### Phase 2 — Blog

- [ ] Set up posts: a content collection of markdown posts (mirror djf.io, adapted to SvelteKit).
- [ ] A post list (home or `/blog`) and individual post pages.
- [ ] RSS / basic metadata once there's something to syndicate.

## Related

- App: [`apps/monicandavid.com`](../../../apps/monicandavid.com/)
- Content approach to mirror: [djf.io](../djf-io/plan.md).
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
