# startchi.com (Chicago Startup Ecosystem)

An ecosystem hub for Chicago and the greater Midwest startup scene — a directory, a signal boost, an
organization hub, and an identity for startups near Chicago.

## Status

**Placeholder** (2026-06-29). Live at startchi.com serving a single centered `<h1>`; a TanStack
Start + Panda/Ark scaffold. Near-term work is a basic layout + positioning, then the confirmed MVP:
the **directory** (submit + browse startups).

## Vision

A center of gravity for Chicago / greater-Midwest startups:

- **Directory** — who's building what, near Chicago. **Confirmed MVP: the first real build.**
- **Signal boost** — surface and amplify what these startups are doing. _(later layer)_
- **Organization hub** — a place the scene can organize around. _(later layer)_
- **Identity** — a recognizable banner for Midwestern startups. _(later layer)_

## Current state (2026-06-19)

- Live at startchi.com (TanStack Start on Cloudflare; custom domain + www wired).
- `src/routes/index.tsx` renders a single centered `<h1>` (Panda `css()`); no real layout yet.

## Stack

TanStack Start (React 19) + PandaCSS + Ark UI, Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + positioning

- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)
- [ ] Land the positioning: what startchi is for, who it serves.

### Phase 2 — Directory MVP (confirmed first real build)

- [ ] Build a submit-a-startup flow (the form that takes a new entry).
- [ ] Build a browse/list view of submitted startups (the directory itself).
- [ ] **Open question — data model + storage** (e.g. D1 vs. KV): decide before the build starts.

### Phase 3 — Community & signal boost (layers on top of the directory)

- [ ] Featured startups, events, and amplification surfaces.

## Related

- App: [`apps/startchi.com`](../../../apps/startchi.com/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
