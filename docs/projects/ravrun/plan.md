# ravrun (Training Plan Generator)

A marathon / endurance training-plan generator and visualizer — parameterize a multi-week schedule
and see the whole block laid out.

## Status

**Functional — full product loop shipped to the branch** (2026-07-01). Domains are live: ravrun.com
and rav.run are wired and now declared in `wrangler.toml` (`custom_domain` routes, same pattern as
davidjfelix.com). The plan engine, form-driven UI (config in URL search params, so plans are
shareable links), feasibility banners, `.ics` export, and a real `/about` all landed; the hardcoded
demo grid is gone. Remaining: taste-tuning the constants against rendered plans.

## Vision

Tell ravrun your race (distance, date, current fitness/paces) and get a structured, visual training
block you can actually follow — and export to your calendar. A focused tool for runners building
toward a goal race.

## Current state (2026-07-01)

- **Plan engine** in `src/lib/plan/` (pure logic, 25 unit tests, repo coverage gate green):
  - `constants.ts` — every tunable training rule (stepback cadence, peak long runs, taper factors,
    pace offsets, ramp cap) in one central object.
  - `paces.ts` — Riegel race prediction, Daniels-lite training pace bands, parse/format helpers.
  - `generate.ts` — race-date-anchored generator: base → build → peak → taper → race phases,
    every-4th-week stepbacks, long-run progression, week template rotating around the long-run day,
    race week with shakeout, pace bands drifting toward goal fitness when the goal is faster than
    predicted. Modeled on David's real 2026 marathon plan (yearroundrunning.com ICS).
  - `feasibility.ts` — achievability findings: aggressive/unrealistic goal vs. Riegel prediction,
    unsafe mileage ramp (with `suggestedWeeks`), too-short plan, window already underway.
  - `ics.ts` — deterministic `.ics` export: one all-day event per workout with distance, pace band,
    and week/phase context.
- **Form-driven UI** on `/`: race, date, goal time, weekly mileage, recent race, plan length,
  long-run day — config lives in URL search params (shareable plans); color-coded grid with phase +
  stepback labels and weekly totals; feasibility banners with a one-click "Use N weeks" fix;
  Download `.ics` button. Visual e2e baseline pins a fully-specified plan URL (including `today`).
- `/about` explains the product: philosophy, how plans are built, paces, honesty checks, sharing.
- Vite + React + Tailwind, built static; **ravrun.com + rav.run wired**, declared in `wrangler.toml`
  as `custom_domain` routes.

## Stack

Vite + React + Tailwind, Cloudflare (static assets).

## Roadmap

### Phase 1 — Plan engine + form-driven input

- [x] Domains: ravrun.com / rav.run are live and declared in `wrangler.toml` as `custom_domain`
      routes (2026-07-01).
- [x] Plan-generation engine (TDD, 2026-07-01): Riegel paces, phased progressive-mileage generator
      anchored on race date, feasibility checker. Constants centralized for controlled tuning.
- [x] Form-driven input wired to the engine (2026-07-01): race distance + date, goal time, current
      weekly mileage, recent race, plan length, long-run day → generated schedule in the grid.
      Config in URL search params so plans are shareable links for free.
- [x] Surface feasibility findings in the UI (2026-07-01): aggressive goal, unsafe ramp with a
      one-click "Use N weeks" button.

### Phase 2 — Make the plan yours

- [x] Flesh out `/about` into a real explainer (2026-07-01).
- [ ] Taste-tune constants against rendered plans (peak long run 20 vs 22, marathon taper 2 vs 1
      weeks).
- [ ] Days-per-week flexibility (template currently assumes 6 run days + rest).

### Phase 3 — Take it with you

- [x] Export the plan to `.ics` (2026-07-01, client-side download); shareable links via URL state.
- [ ] Post-race continuation blocks (recovery / maintenance appended after race week).

## Related

- App: [`apps/ravrun`](../../../apps/ravrun/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
