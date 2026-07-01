# ravrun (Training Plan Generator)

A marathon / endurance training-plan generator and visualizer — parameterize a multi-week schedule
and see the whole block laid out.

## Status

**Functional — plan engine landed, UI wiring next** (2026-07-01). Domains are live: ravrun.com and
rav.run are wired (configured in the Cloudflare dashboard; `wrangler.toml` doesn't declare them —
optional cleanup to make that declarative). A real training-plan engine now lives in `src/lib/plan/`
(built TDD, 100% statement coverage); the near-term work is wiring the form UI + URL state on top of
it, replacing the hardcoded demo grid.

## Vision

Tell ravrun your race (distance, date, current fitness/paces) and get a structured, visual training
block you can actually follow — and export to your calendar. A focused tool for runners building
toward a goal race.

## Current state (2026-07-01)

- **Plan engine** in `src/lib/plan/` (pure logic, 20 unit tests, repo coverage gate green):
  - `constants.ts` — every tunable training rule (stepback cadence, peak long runs, taper factors,
    pace offsets, ramp cap) in one central object.
  - `paces.ts` — Riegel race prediction, Daniels-lite training pace bands, parse/format helpers.
  - `generate.ts` — race-date-anchored generator: base → build → peak → taper → race phases,
    every-4th-week stepbacks, long-run progression, week template rotating around the long-run day,
    race week with shakeout. Modeled on David's real 2026 marathon plan (yearroundrunning.com ICS).
  - `feasibility.ts` — achievability findings: aggressive/unrealistic goal vs. Riegel prediction,
    unsafe mileage ramp (with `suggestedWeeks`), too-short plan, window already underway.
- UI still renders the old hardcoded 18-week demo grid — not yet wired to the engine.
- `/about` is a stub.
- Vite + React + Tailwind, built static; **ravrun.com + rav.run wired** (dashboard-configured).

## Stack

Vite + React + Tailwind, Cloudflare (static assets).

## Roadmap

### Phase 1 — Plan engine + form-driven input

- [x] Domains: ravrun.com / rav.run are live (dashboard-configured, 2026-07-01). Optional: declare
      them in `wrangler.toml` so the config is committed.
- [x] Plan-generation engine (TDD, 2026-07-01): Riegel paces, phased progressive-mileage generator
      anchored on race date, feasibility checker. Constants centralized for controlled tuning.
- [ ] Form-driven input wired to the engine: race distance + date, goal time, current weekly
      mileage, recent race, days/week, long-run day → generated schedule in the grid. Config in URL
      search params so plans are shareable links for free.
- [ ] Surface feasibility findings in the UI (aggressive goal, unsafe ramp + suggested weeks).

### Phase 2 — Make the plan yours

- [ ] Flesh out `/about` into a real explainer.

### Phase 3 — Take it with you

- [ ] Export the plan to `.ics` / calendar; shareable links.

## Related

- App: [`apps/ravrun`](../../../apps/ravrun/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
