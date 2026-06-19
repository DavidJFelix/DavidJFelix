# onvibes.org (Vibecoded Apps)

Two things under one roof: a **showcase** of "vibecoded" apps, and a **builder toolchain** for
creating them. Astro-based.

## Status

**Placeholder** (2026-06-19). Live at onvibes.org serving a single centered `<h1>`; Astro + Panda
scaffold with smoke + e2e in place. Near-term work is a basic layout and the showcase scaffold.

## Vision

onvibes.org has two halves:

1. **Showcase** — a gallery of "vibecoded" apps (apps built fast, by vibe). Browse them, see what
   they are, link out.
2. **Builder toolchain** — Astro-based tooling that helps you _build_ vibecoded apps, not just look
   at them. This is the part with an LLM in the loop.

> ⚠️ **Auth required (requirement noted 2026-06-19, mechanism TBD).** The builder's LLM must sit
> behind authentication before it's exposed — to prevent abuse and uncontrolled cost. Decide the
> mechanism (Cloudflare Access vs. accounts vs. token gate) when the builder work is picked up.

## Current state (2026-06-19)

- Live at onvibes.org (Astro on Cloudflare; custom domain + www wired; `preview_urls` on).
- `src/pages/index.astro` renders a single centered `<h1>` (Panda `css()`); no real layout yet.
- Smoke + Playwright e2e already wired.

## Stack

Astro + PandaCSS, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + showcase scaffold

- [x] Replace the single `<h1>` with a real layout: header, hero explaining onvibes, footer. (done
      2026-06-19)
- [ ] Scaffold the showcase: a grid of vibecoded apps (data-driven, even if seeded with a few).

### Phase 2 — Builder toolchain MVP → spins out as its own project

- [ ] Define the smallest useful builder flow.
- [ ] ⚠️ Put the LLM behind auth first (mechanism TBD — see Vision).

## Spin-outs / related

- Likely spin-outs when picked up: "onvibes showcase", "onvibes builder".
- App: [`apps/onvibes.org`](../../../apps/onvibes.org/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
