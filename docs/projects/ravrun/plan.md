# ravrun (Training Plan Generator)

A marathon / endurance training-plan generator and visualizer — parameterize a multi-week schedule
and see the whole block laid out.

## Status

**Functional — no real domain, no tests** (2026-06-19). A working schedule grid built from a
hardcoded demo plan, on a `workers.dev` URL. Needs framing, a domain, and a test floor.

## Vision

Tell ravrun your race (distance, date, current fitness/paces) and get a structured, visual training
block you can actually follow — and export to your calendar. A focused tool for runners building
toward a goal race.

## Current state (2026-06-19)

- Functional week-by-week schedule grid (an 18-week demo plan, hardcoded).
- `/about` is a stub.
- Vite + React + Tailwind, built static.
- **Deploys only to `workers.dev`** — `wrangler.toml` has no custom domain/route.
- **No tests yet.**

## Stack

Vite + React + Tailwind, Cloudflare (static assets).

## Roadmap

### Phase 1 — Frame it + give it a home + a test floor

- [ ] Settle the name/brand and a real domain (today it's `workers.dev` only).
- [ ] Add a basic test for the plan-generation logic before it grows.

### Phase 2 — Make the plan yours

- [ ] Form-driven input: distance, target paces, start date, number of weeks → generated schedule
      (replace the hardcoded demo).
- [ ] Flesh out `/about` into a real explainer.

### Phase 3 — Take it with you

- [ ] Export the plan to `.ics` / calendar; shareable links.

## Related

- App: [`apps/ravrun`](../../../apps/ravrun/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
