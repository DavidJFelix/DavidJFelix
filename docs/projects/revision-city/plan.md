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

## Current state (2026-08-04)

- Live at revision.city (TanStack Start on Cloudflare; custom domain + www wired).
- Landing page with header/hero/feature cards; the Diffs card links to `/diffs`.
- The diffs half is functional: a GitHub diff viewer ported from Pierre's diffshub lives under
  `/diffs` (`src/diffs/` feature tree + `src/routes/diffs/`), rewritten to Panda CSS and TanStack
  Start server routes; see [2026-07-23-progress.md](2026-07-23-progress.md).
- Symbol tracking is live in the viewer (2026-08-04): a Symbols tab beside Files and Comments names
  the functions, classes and config keys a diff changed, across the fifteen first-party Lezer
  grammars that carry symbols. Parsed in the worker and streamed down; works signed out on public
  repos.
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
- [x] `/api/diffs/entity-diff` route that expands one diff entry into an entity diff, parsed in the
      worker so no grammar reaches the browser. (done 2026-08-04)
- [x] Symbols tab in the viewer's sidebar: changes grouped by file, clicking a row scrolls to the
      entity. Fetches nothing until the tab is opened. (done 2026-08-04)
- [x] Works signed out on public repos, matching how the viewer already loads patches. A session
      adds private repos and a higher rate limit. (done 2026-08-04)
- [x] Results stream from the worker as newline-delimited JSON, one line per file, batched twenty at
      a time to stay inside a request's subrequest budget. (done 2026-08-04)
- [ ] Report each change once, at the highest node that describes it. Three parts, designed and
      prototype-validated in [2026-08-06-progress.md](2026-08-06-progress.md): occurrence alignment
      in the matcher (kills the `#n` positional-identity cascade on array insertions), element-level
      sequence detail on array-valued properties (`words: 167 -> 169, "ciphertext" inserted at 9`),
      and rollup of entity rows inside inserted/deleted elements. Cuts PR #409's cspell.jsonc report
      from 21 rows to 3.
- [ ] Cache entity diffs across page loads, keyed by blob SHA pair. Results are currently held only
      for the life of the page; the answer is immutable per revision pair, so KV or the Cache API
      would make a revisited PR free.
- [ ] Summary counts on the tab itself (a badge like Comments has), which needs a cheap way to know
      the totals without doing the per-file work first.
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
