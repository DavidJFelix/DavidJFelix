# calendar-visualizer (Year Planning Tool)

An interactive full-year calendar that overlays weekends, holidays, and custom project phases — a
single-screen tool for planning and visualizing a year at a glance.

## Status

**Functional — staying on `workers.dev` for now** (2026-06-29). Works end to end and has unit tests.
Intentionally stays on the `workers.dev` URL until the product is fleshed out — the near-term work
is product definition, not a domain decision.

## Vision

A genuinely useful year-at-a-glance planner: drop in your project phases, holidays, and key dates
and see the whole year laid out, with overlays that make conflicts and gaps obvious. Shareable, and
configurable to _your_ year — not a fixed demo.

## Current state (2026-06-29)

- Functional full-year grid with weekend/holiday/phase overlays; unit-tested (`src/lib`).
- Astro + React + PandaCSS, built static.
- **Stays on `workers.dev` intentionally** — no custom domain until the product is defined; a domain
  decision is deferred, not blocking.
- Data is largely hardcoded (a fixed year + sample phases), not user-supplied.

## Stack

Astro + React + PandaCSS, Cloudflare (static assets).

## Roadmap

### Phase 1 — Define the product

- [ ] Decide what the product actually does and who it's for — the blocking question.
- [ ] Defer the domain decision until then; stay on `workers.dev` in the meantime.

### Phase 2 — Make it yours (follows product definition)

- [ ] User-configurable data: pick the year, enter your own phases/holidays/dates (not hardcoded).
- [ ] Persist a configuration (URL-encoded state or storage).

### Phase 3 — Share & export (follows product definition)

- [ ] Shareable view links; export to image/PDF or `.ics`.

## Related

- App: [`apps/calendar-visualizer`](../../../apps/calendar-visualizer/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
