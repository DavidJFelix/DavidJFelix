# monicandavid.com (Monica & David)

A personal site for Monica & David. **Vision assumed — see below; confirm before building content.**

## Status

**Placeholder** (2026-06-19). Live at monicandavid.com serving a single centered `<h1>`. SvelteKit

- PandaCSS scaffold in place. Near-term work is a basic layout once the purpose is confirmed.

## Vision

> ⚠️ **Assumed, pending David's confirmation.** Best guess: a shared site for Monica & David — a
> couple/home page, or a wedding/event site (the domain reads as both names). Could also be a
> household hub. The basic layout is purpose-agnostic; the content direction is not, so confirm
> before Phase 2.

## Current state (2026-06-19)

- Live at monicandavid.com (SvelteKit on Cloudflare; custom domain + www wired).
- `src/routes/+page.svelte` renders a single centered `<h1>` (Panda `css()`); no real layout yet.

## Stack

SvelteKit + PandaCSS, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout

- [ ] Confirm the site's purpose with David.
- [ ] Replace the single `<h1>` with a real layout: header, hero (who/what), footer.

### Phase 2 — Content (purpose-dependent)

- [ ] Build out the content the confirmed purpose calls for (story/event details, or a home hub).

## Related

- App: [`apps/monicandavid.com`](../../../apps/monicandavid.com/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
