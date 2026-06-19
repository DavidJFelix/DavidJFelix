# davidjfelix.com (Identity Landing)

A minimal personal landing page — David's name, a one-line bio, and links out to djf.io and
profiles. The "business card" domain.

## Status

**Real, minimal** (2026-06-19). Live at davidjfelix.com: a single dark-themed landing page with a
bio line and profile links. Not a placeholder, but intentionally small.

## Vision

A fast identity hub: someone who lands on davidjfelix.com immediately knows who David is and where
to go next (djf.io for writing, plus social/professional profiles). It stays small on purpose — the
real content home is djf.io.

## Current state (2026-06-19)

- Live at davidjfelix.com (Astro static on Cloudflare; custom domain + www wired).
- One hand-styled page (`src/pages/index.astro`): name, bio paragraph, link list. Inline CSS, dark
  theme — no Panda/React.

## Stack

Astro (static), inline CSS, Cloudflare (static assets).

## Roadmap

### Phase 1 — Brand consistency

- [ ] Align type/color with djf.io so the two sites read as one identity.
- [ ] Confirm the profile link list is current.

### Phase 2 — Decide the ceiling

- [ ] Keep as a redirect/identity hub, or expand into a richer about/now page. Default: keep small.

## Related

- App: [`apps/davidjfelix.com`](../../../apps/davidjfelix.com/)
- Points at [djf.io](../djf-io/plan.md), the content home.
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md).
