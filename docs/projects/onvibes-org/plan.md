# onvibes.org (Vibecoded Apps)

Two things under one roof: a **showcase** of "vibecoded" apps, and a **builder toolchain** for
creating them. Astro-based.

## Status

**Early build** (2026-07-02). Live at onvibes.org with the landing layout and a `/chat` demo backed
by a Flue agent in the deployed Worker (faux echo until a real model is wired). Near-term work is
the showcase scaffold and the real-model swap (blocked on the auth decision).

## Vision

onvibes.org has two halves:

1. **Showcase** — a gallery of "vibecoded" apps (apps built fast, by vibe). Browse them, see what
   they are, link out.
2. **Builder toolchain** — Astro-based tooling that helps you _build_ vibecoded apps, not just look
   at them. This is the part with an LLM in the loop.

> ⚠️ **Auth required (requirement noted 2026-06-19, mechanism TBD).** The builder's LLM must sit
> behind authentication before it's exposed — to prevent abuse and uncontrolled cost. Decide the
> mechanism (Cloudflare Access vs. accounts vs. token gate) when the builder work is picked up.

## Current state (2026-07-02)

- Live at onvibes.org (custom domain + www wired; `preview_urls` on). The deployed Worker is now
  **Flue hosting Astro**: `src/app.ts` mounts the Flue agent API at `/api` and forwards everything
  else to the prebuilt Astro worker (see PR #303 and the 2026-07-02 progress note).
- `/` renders the header/hero/footer layout; `/chat` is a React island talking to a keyless faux
  echo agent (`src/agents/assistant.ts`) — the first builder-toolchain slice.
- Smoke boots the Flue worker, checks `/` + `/chat`, and POSTs the agent endpoint; Playwright e2e
  boots the same worker.

## Stack

Astro + PandaCSS + React islands, Flue (agents on Durable Objects), Cloudflare Worker.

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
