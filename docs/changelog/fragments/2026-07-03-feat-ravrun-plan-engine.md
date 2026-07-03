### feat(ravrun): training-plan engine, form UI, feasibility checks, ics export

ravrun generates real training plans now, replacing the hardcoded 18-week demo grid. A TDD-built
engine in `src/lib/plan/` (100% statement coverage) holds the logic: Riegel race prediction and
training pace bands, a race-date-anchored progressive-mileage generator (base → build → peak → taper
→ race phases, every-4th-week stepbacks, long runs climbing from current fitness to a
distance-specific peak, the week rotating around a chosen long-run day, pace bands drifting toward
goal fitness when the goal outruns the prediction), and a feasibility checker that flags
aggressive/unrealistic goals, unsafe mileage ramps (with a suggested duration that resolves its own
warning), too-short blocks, and already-underway windows. Every tunable training rule lives in one
`constants.ts` object so opinions are one-line edits guarded by anchor tests. The UI keeps its whole
config in URL search params (plans are shareable links), renders a color-coded grid on desktop and a
stacked agenda on phones, surfaces feasibility banners with a one-click "Use N weeks" fix, and
exports the plan as `.ics` all-day events. The custom domains ravrun.com and rav.run are now
declared in `wrangler.toml`, and `/about` explains the methodology.
