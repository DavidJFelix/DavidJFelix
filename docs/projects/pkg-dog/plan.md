# pkg.dog (Focusing-Lens Package Manager)

A new kind of package manager: it actively tree-shakes published ESM + TypeScript packages into
their independent parts and republishes those parts — giving downstream users a "focusing lens" on
updates and vulnerabilities. The most ambitious app in the repo.

## Status

**Feasibility proven for the happy path** (2026-07-02). The Phase 2 spike
([`apps/pkg.dog/spike`](../../../apps/pkg.dog/spike/)) decomposes `@std/collections@1.3.0` into 50
independently installable parts that verify against upstream and pass `npm publish --dry-run`. The
landing (Phase 1) now explains the focusing lens with a fetch/decompose/republish strip and a proof
line. Next: real `@pkgdog/*` publish and a messier second target.

## Vision

pkg.dog republishes packages _decomposed into their independent parts_. By tree-shaking published
ESM/TypeScript packages and re-publishing the pieces, it gives downstream users a focusing lens:

- **Ignore irrelevant alerts.** A vulnerability or update on a part of a package you don't import
  shouldn't page you. pkg.dog lets you safely ignore alerts on paths that don't affect you.
- **Upgrade types safely.** Move types forward across versions without dragging in unrelated churn.

Start with the JSR / ESM / TypeScript world (where decomposition is cleanest); expand to more
ecosystems later.

## Current state (2026-07-02)

- Live at pkg.dog + www, and pkgdog.com + www (Nuxt on Cloudflare; all four custom domains wired).
- Landing explains the concept: hero, three-step fetch/decompose/republish strip, proof line, two
  feature cards. Smoke + Playwright e2e (visual baseline) wired.
- `apps/pkg.dog/spike/` holds the working decompose pipeline (bun; see its README for the algorithm,
  results, and deliberate cuts).

## Stack

Nuxt + Vue + PandaCSS (+ Ark UI), Cloudflare Worker.

## Roadmap

### Phase 1 — Basic layout + explainer landing (complete)

- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)
- [x] Write the landing copy that explains the focusing-lens idea clearly. (done 2026-07-02:
      three-step fetch/decompose/republish strip + proof line)

### Phase 2 — Feasibility spike → spins out (likely with a design doc)

- [x] Prototype the core pipeline: decompose a published ESM/TS package into independent parts and
      emit them as publishable packages. (done 2026-07-02: `@std/collections` -> 50 parts, all
      verified against upstream, all passing `npm publish --dry-run`)
- [ ] Run the first real publish under `@pkgdog/*` (blocked on the npm org + token — human task).
- [ ] Prove the messy middle: decompose a package with heavy shared internals (es-toolkit, then zod)
      and validate the "ignore irrelevant alerts / upgrade types safely" claim on it.

### Phase 3 — MVP

- [ ] A usable flow for a single package end to end; then widen.

> **Feasibility (answered for the happy path, 2026-07-02).** The decompose-and-republish pipeline
> works on stdlib-shaped packages: per-export parts, real cross-part dependencies with rewritten
> specifiers, shared internals split out, cycles merged, barrels skipped. Still open: packages with
> deep shared-internal graphs and type-only entanglement — that's what the second target must answer
> before the MVP is scoped. See
> [`apps/pkg.dog/spike/README.md`](../../../apps/pkg.dog/spike/README.md).

## Related

- App: [`apps/pkg.dog`](../../../apps/pkg.dog/)
- Premium domains held: pkg.dog and pkgdog.com.
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
