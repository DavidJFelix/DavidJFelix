# revision.city (Reviews & Diffs)

A centralized version-control service that manages reviews and diffs.

## Status

**Placeholder** (2026-06-19). Live at revision.city serving a single centered `<h1>`; TanStack
Start + Panda/Ark scaffold. Near-term work is a basic layout + positioning, then scoping the MVP.

## Vision

A centralized home for version control focused on the _review_ experience — managing reviews and
diffs as first-class objects. The exact shape is open (a hosted VCS? a review/diff layer on top of
git or GitHub? a great standalone diff viewer?), and scoping that is the first real design task.

## Current state (2026-06-19)

- Live at revision.city (TanStack Start on Cloudflare; custom domain + www wired).
- `src/routes/index.tsx` renders a single centered `<h1>` (Panda `css()`); no real layout yet.

## Stack

TanStack Start (React 19) + PandaCSS + Ark UI, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + positioning

- [ ] Replace the single `<h1>` with a real layout: header, hero, footer.
- [ ] Land a positioning line: what "reviews & diffs, centralized" means here.

### Phase 2 — Scope the MVP → spins out (design doc)

- [ ] Decide the product shape: hosted VCS vs. review layer atop git/GitHub vs. diff viewer.
- [ ] Write it up before building.

### Phase 3 — MVP

- [ ] Build the smallest version of the chosen shape.

> Note: this is a large idea; near-term is layout + clear positioning + a scoping doc, not a VCS.

## Related

- App: [`apps/revision.city`](../../../apps/revision.city/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
