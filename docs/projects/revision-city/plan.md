# revision.city (Reviews & Diffs)

A centralized version-control service that manages reviews and diffs.

## Status

**Placeholder** (2026-06-19). Live at revision.city serving a single centered `<h1>`; TanStack
Start + Panda/Ark scaffold. Near-term work is a basic layout + positioning, then scoping the MVP.

## Vision

A centralized home for version control focused on the _review_ experience — managing reviews and
diffs as first-class objects.

> ⚠️ **Open question — MVP shape (deferred 2026-06-29).** The product shape is _not_ yet captured
> here. It is a nuanced vision David will articulate himself, in his own words; it does not reduce
> to a multiple-choice pick, so this plan deliberately does not propose or pin a direction. Until
> David writes it up, the MVP shape is the open, blocking question — nothing downstream is scoped.

## Current state (2026-08-03)

- Live at revision.city (TanStack Start on Cloudflare; custom domain + www wired).
- Landing page with header/hero/feature cards; the Diffs card links to `/diffs`.
- The diffs half is functional: a GitHub diff viewer ported from Pierre's diffshub lives under
  `/diffs` (`src/diffs/` feature tree + `src/routes/diffs/`), rewritten to Panda CSS and TanStack
  Start server routes; see [2026-07-23-progress.md](2026-07-23-progress.md).
- An entity-diff engine lands in `src/symbols/lib/` (2026-08-03): it names the functions, classes
  and config keys that changed between two revisions, across the fifteen first-party Lezer grammars
  that carry symbols. Pure logic only — no route and no UI consume it yet.
- Reviews remain unscoped pending the MVP-shape doc (the Phase 2 gate below).

## Stack

TanStack Start (React 19) + PandaCSS + Ark UI, Cloudflare Worker.

## Roadmap

### Phase 1 — Position the concept

- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)
- [ ] Land a positioning line: what "reviews & diffs, centralized" means here.

### Phase 2 — David defines the MVP shape (design/positioning doc — the gate)

- [ ] **David articulates the MVP vision himself**, in his own words — this is his call, and it is
      the open, blocking question (see Vision). The plan does not pre-decide a direction.
- [ ] Capture it as a design/positioning doc. That doc is the gate before any build.

### Phase 3 — MVP

- [ ] Build the smallest version of the shape David defines.

> Note: this is a large idea; near-term is layout + clear positioning. No build starts until the MVP
> shape is written down — and that shape is David's to articulate, not something this plan pins.

### Symbol tracking (diffs half — independent of the Phase 2 gate)

Entity-level diffing, so a review reads in functions rather than hunks. The engine exists; the rest
is wiring and reach.

- [x] Entity-diff engine over Lezer: extraction tables per grammar, sem's three-phase matcher, all
      fifteen first-party CodeMirror grammars that carry symbols. (done 2026-08-03)
- [ ] Server route that expands a diff entry into an entity diff, cached by blob SHA pair — the
      caching is the reason this belongs on the server rather than in the viewer's worker pool.
- [ ] "Changed symbols" panel in the viewer, grouped by bucket, clicking through to the hunk.
- [ ] Call sites for a changed symbol: GitHub code search for candidates, confirmed by parsing the
      candidate files, so hits are real call expressions rather than text matches.

> Open question for the call-site work: repo-scoped code search only covers the default branch and
> is rate-limited. If that proves too coarse, the fallbacks are a TypeScript language service over a
> lazily-fetched virtual filesystem (TS only, large) or running real `sem` in a Cloudflare Container
> for its dependency graph (all languages, needs a clone per request).

## Related

- App: [`apps/revision.city`](../../../apps/revision.city/)
- Cross-cutting: Sentry + PostHog observability are live fleet-wide (projects closed 2026-07-30; see
  the [changelog](../../changelog/)).
