# ravrun (Training Plan Generator)

A marathon / endurance training-plan generator and visualizer — parameterize a multi-week schedule
and see the whole block laid out.

## Status

**Functional — domains owned, thin test floor** (2026-06-29). A working schedule grid built from a
hardcoded demo plan, still served on a `workers.dev` URL even though two domains are already owned.
Near-term: wire the custom domain(s), replace the hardcoded demo with form-driven input, and grow
the thin test coverage.

## Vision

Tell ravrun your race (distance, date, current fitness/paces) and get a structured, visual training
block you can actually follow — and export to your calendar. A focused tool for runners building
toward a goal race.

## Current state (2026-06-29)

- Functional week-by-week schedule grid (an 18-week demo plan, hardcoded).
- `/about` is a stub.
- Vite + React + Tailwind, built static.
- **Two domains already owned: ravrun.com and rav.run** — but `wrangler.toml` still has no custom
  domain/route, so it deploys only to `workers.dev`.
- **Thin test floor** — ~4 unit-test stubs exist; coverage is minimal.

## Stack

Vite + React + Tailwind, Cloudflare (static assets).

## Roadmap

### Phase 1 — Wire the domains + form-driven input + flesh out tests

- [ ] Wire the owned domain(s) ravrun.com / rav.run into `apps/ravrun/wrangler.toml` so it leaves
      the `workers.dev` URL.
- [ ] Form-driven input: distance, target paces, start date, number of weeks → generated schedule
      (replace the hardcoded 18-week demo).
- [ ] Flesh out the thin (~4 stub) test coverage for the plan-generation logic before it grows.

### Phase 2 — Make the plan yours

- [ ] Flesh out `/about` into a real explainer.

### Phase 3 — Take it with you

- [ ] Export the plan to `.ics` / calendar; shareable links.

## Related

- App: [`apps/ravrun`](../../../apps/ravrun/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
