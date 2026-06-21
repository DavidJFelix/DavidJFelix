# djf.io (Personal Site)

David's personal site and blog — long-form writing on software, plus the bio/home that fronts his
web identity. The most built-out app in the repo.

## Status

**Built-out — actively iterating** (2026-06-19). Live at djf.io with content, search, and feeds. Two
child projects drive ongoing work: `blog-style-improvement` (visual/UX, David-driven) and
`blog-content` (the writing).

## Vision

The durable home for David on the web: a fast, well-designed blog where the writing is the point,
polished enough that the design itself reads as a portfolio piece. Everything else (davidjfelix.com,
profiles) points here.

## Current state (2026-06-19)

- Live at djf.io (Astro static on Cloudflare; custom domain wired).
- Blog posts in `src/content/blog/` (MDX), bio homepage, Pagefind search, RSS, sitemap, OG images.
- standard.site / ATProto integration shipped (posts mirrored as AT records; #252–#254).
- Playwright e2e is the canonical runtime gate (it subsumes smoke); vitest covers `src/lib` at 100%.

## Stack

Astro + MDX + React, PandaCSS, Pagefind (search), Cloudflare (static assets).

## Roadmap

App-level direction. Concrete pushes spin out as their own projects (below) or issues.

### Style & UX — `blog-style-improvement` (active, David-driven)

- [ ] David's concrete change list (colors, spacing, layout, images, usability, components),
      reviewed through per-PR preview URLs.

### Content — `blog-content` (active)

- [ ] "attention is all you need" — first post (callback to the Transformer paper; on using LLMs in
      your work).
- [ ] Establish a publishing cadence.

### Features (as the writing warrants)

- [ ] Post series / tags / archive surfaces if volume justifies them.
- [ ] Webmentions or comments — only if wanted.
- [ ] Newsletter — deferred until there's a reason.

## Spin-outs / related

- [blog-content](../blog-content/plan.md) — the writing.
- [blog-style-improvement](../blog-style-improvement/plan.md) — visual/UX polish.
- App: [`apps/djf.io`](../../../apps/djf.io/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
