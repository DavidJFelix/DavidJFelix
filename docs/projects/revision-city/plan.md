# revision.city (Reviews & Diffs)

A centralized version-control service that manages reviews and diffs.

## Status

**Live** (2026-11-09). revision.city serves a landing page, a diff viewer with symbol tracking under
`/diffs`, and automated pull request reviews through its GitHub App. The reviews have their own
plan: [revision-city-reviews](../revision-city-reviews/plan.md).

## Vision

A centralized home for version control focused on the _review_ experience — managing reviews and
diffs as first-class objects.

> **Open question — MVP shape (deferred 2026-06-29).** The product shape is _not_ yet captured here.
> It is a nuanced vision David will articulate himself, in his own words; it does not reduce to a
> multiple-choice pick, so this plan deliberately does not propose or pin a direction.

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
- A shared `/diffs` link unfurls as the diff it names (2026-09-23): title, description, and a card
  at `/og/diffs/<path>.png` derived from the URL, plus the public pull request title, author, state,
  and counts where GitHub shows them to anyone. Private diffs unfurl with only what the link already
  says.
- Automated pull request reviews are built and tracked in
  [revision-city-reviews](../revision-city-reviews/plan.md).

## Telemetry and privacy

A signed-in visitor can open a private repository. The rule for what each telemetry service may hold
(decided 2026-11-14):

- PostHog, Honeycomb and Cloudflare Workers Logs may hold the repository owner, the repository name,
  the pull number and file paths. PostHog keeps full paths, so page views can be broken down by
  repository.
- Sentry holds route templates such as `/diffs/$path`, not repository paths.
- No service holds private code or model reasoning about private code.

Today (main `c34990a`) the code follows the PostHog and Honeycomb parts of the rule but not the
Sentry part:

- PostHog page views carry the full viewer path.
- Cloudflare's automatic traces in Honeycomb carry the full URL of each request and of each GitHub
  call. App code cannot remove these URLs. The failed upstream log line holds the full patch URL.
  The `webhook delivery` event names any repository that is not allowed.
- Sentry in the browser names page loads and API calls by the full URL. On the server, the title of
  a 5xx message holds the request path. The message also carries the console breadcrumbs of the
  request, which can include the failed upstream log line and its URL.
- No service gets private code today. The one risk is the `reasoningTail` of a cut model reply in
  the `model call` event. Today it can quote only the one allowed repository, which is public.

Two follow-up changes make Sentry follow the rule. The first gives Sentry in the browser route
templates for page loads and API calls. The second does the same for Sentry on the server: the 5xx
title and the upstream log line name the route and the host, not the repository.

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

> Note: the MVP shape is David's to articulate, not something this plan pins.

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
- [x] Report each change once, at the highest node that describes it. Three parts, designed,
      prototype-validated, and implemented in [2026-08-06-progress.md](2026-08-06-progress.md):
      occurrence alignment in the matcher (kills the `#n` positional-identity cascade on array
      insertions), element-level sequence detail on array-valued properties
      (`words: 167 -> 169,     "ciphertext" inserted at 9`), and rollup of entity rows inside
      inserted/deleted elements. Cuts PR #409's cspell.jsonc report from 21 rows to 3. (done
      2026-08-06; follow-ups -- YAML sequences, coalesced `changed` edits, indexed display names --
      listed in the progress note)
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

- App: [`workspaces/web-apps/apps/revision.city`](../../../workspaces/web-apps/apps/revision.city/)
- Cross-cutting: Sentry + PostHog observability are live fleet-wide (projects closed 2026-07-30; see
  the [changelog](../../changelog/)).
