# pkg.dog (Focusing-Lens Package Manager)

A new kind of package manager: it actively tree-shakes published ESM + TypeScript packages into
their independent parts and republishes those parts — giving downstream users a "focusing lens" on
updates and vulnerabilities. The most ambitious app in the repo.

## Status

**Placeholder — ambitious** (2026-06-19). Live at pkg.dog (and pkgdog.com) serving a single centered
`<h1>`. The near-term deliverable is a basic layout + an explainer landing; the real product is a
research-heavy build.

## Vision

pkg.dog republishes packages _decomposed into their independent parts_. By tree-shaking published
ESM/TypeScript packages and re-publishing the pieces, it gives downstream users a focusing lens:

- **Ignore irrelevant alerts.** A vulnerability or update on a part of a package you don't import
  shouldn't page you. pkg.dog lets you safely ignore alerts on paths that don't affect you.
- **Upgrade types safely.** Move types forward across versions without dragging in unrelated churn.

Start with the JSR / ESM / TypeScript world (where decomposition is cleanest); expand to more
ecosystems later.

## Current state (2026-06-19)

- Live at pkg.dog + www, and pkgdog.com + www (Nuxt on Cloudflare; all four custom domains wired).
- `app/app.vue` renders a single centered `<h1>` (Panda `css()`); no real layout yet.
- Smoke + Playwright e2e already wired.

## Stack

Nuxt + Vue + PandaCSS (+ Ark UI), Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + explainer landing

- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)
- [ ] Write the landing copy that explains the focusing-lens idea clearly (this concept needs
      explaining before anything else matters).

### Phase 2 — Feasibility spike → spins out (likely with a design doc)

- [ ] Prototype the core pipeline: tree-shake a published ESM/TS package into independent parts and
      republish them (start with one real package from JSR).
- [ ] Validate the "ignore irrelevant alerts / upgrade types safely" claim on that prototype.

### Phase 3 — MVP

- [ ] A usable flow for a single package end to end; then widen.

> Note: Phase 2+ is a major research effort, not a weekend. Phase 1 (layout + explainer) is the
> realistic near-term goal.

## Related

- App: [`apps/pkg.dog`](../../../apps/pkg.dog/)
- Premium domains held: pkg.dog and pkgdog.com.
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
