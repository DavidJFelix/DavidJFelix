# startchi.com (Chicago Startup Ecosystem)

An ecosystem hub for Chicago and the greater Midwest startup scene — a directory, a signal boost, an
organization hub, and an identity for startups near Chicago.

## Status

**Placeholder** (2026-06-19). Live at startchi.com serving a single centered `<h1>`; TanStack Start

- Panda/Ark scaffold. Near-term work is a basic layout + positioning, then a directory MVP.

## Vision

A center of gravity for Chicago / greater-Midwest startups:

- **Directory** — who's building what, near Chicago.
- **Signal boost** — surface and amplify what these startups are doing.
- **Organization hub** — a place the scene can organize around.
- **Identity** — a recognizable banner for Midwestern startups.

## Current state (2026-06-19)

- Live at startchi.com (TanStack Start on Cloudflare; custom domain + www wired).
- `src/routes/index.tsx` renders a single centered `<h1>` (Panda `css()`); no real layout yet.

## Stack

TanStack Start (React 19) + PandaCSS + Ark UI, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + positioning

- [ ] Replace the single `<h1>` with a real layout: header, hero, footer.
- [ ] Land the positioning: what startchi is for, who it serves.

### Phase 2 — Directory MVP → spins out

- [ ] Submit-a-startup flow + a browsable list (the core utility).

### Phase 3 — Community & signal boost

- [ ] Featured startups, events, and amplification surfaces.

## Related

- App: [`apps/startchi.com`](../../../apps/startchi.com/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
