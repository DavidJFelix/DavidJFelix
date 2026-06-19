# calendar-visualizer (Year Planning Tool)

An interactive full-year calendar that overlays weekends, holidays, and custom project phases — a
single-screen tool for planning and visualizing a year at a glance.

## Status

**Functional — no real domain yet** (2026-06-19). Works end to end and has unit tests, but ships
only on a `workers.dev` URL. The near-term questions are product framing and a real home.

## Vision

A genuinely useful year-at-a-glance planner: drop in your project phases, holidays, and key dates
and see the whole year laid out, with overlays that make conflicts and gaps obvious. Shareable, and
configurable to _your_ year — not a fixed demo.

## Current state (2026-06-19)

- Functional full-year grid with weekend/holiday/phase overlays; unit-tested (`src/lib`).
- Astro + React + PandaCSS, built static.
- **Deploys only to `workers.dev`** — `wrangler.toml` has no custom domain/route.
- Data is largely hardcoded (a fixed year + sample phases), not user-supplied.

## Stack

Astro + React + PandaCSS, Cloudflare (static assets).

## Roadmap

### Phase 1 — Frame it + give it a home

- [ ] Decide the product framing: standalone tool vs. a labeled tool under another site.
- [ ] Decide a real domain (own domain) or a subpath, and wire it (today it's `workers.dev` only).

### Phase 2 — Make it yours

- [ ] User-configurable data: pick the year, enter your own phases/holidays/dates (not hardcoded).
- [ ] Persist a configuration (URL-encoded state or storage).

### Phase 3 — Share & export

- [ ] Shareable view links; export to image/PDF or `.ics`.

## Related

- App: [`apps/calendar-visualizer`](../../../apps/calendar-visualizer/)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
