# Projects

Ongoing projects and their documentation.

The portfolio is organized around **apps**: every app in `apps/` has a persistent _umbrella_ project
(vision, current state, roadmap), and high-value efforts spin out from those umbrellas as focused,
ephemeral task projects or GitHub issues. App umbrellas don't "close" — they're living roadmaps;
task projects close and are captured in the [changelog](changelog/). Cross-cutting and
infrastructure work sits below the apps it serves. Reorganized 2026-06-19 (project-per-app
revision); last reviewed 2026-06-29 (portfolio status review). Current active focus: **djf.io
content + polish**.

Status legend:

- App umbrellas: **Built-out** / **Functional** / **Placeholder** / **Idea**
- Task projects: **Active** / **Blocked** / **Parked** / **Deferred**

## Apps

The product surface. Ordered by where the next valuable work is — content polish → domains & layouts
→ LLM features.

### Built-out & functional (real substance — polish first)

#### [djf.io](./projects/djf-io/plan.md)

Personal site + blog; the most built-out app. Live with content, search, and feeds. Drives two child
projects: visual/UX polish and the writing.

**Status**: Built-out · spin-outs: [blog-content](./projects/blog-content/plan.md),
[blog-style-improvement](./projects/blog-style-improvement/plan.md)

#### [calendar-visualizer](./projects/calendar-visualizer/plan.md)

Interactive full-year calendar overlaying weekends/holidays/custom phases. Functional and
unit-tested. Staying on `workers.dev` intentionally until the product is defined — the near-term
work is deciding what it actually does, then user-configurable data.

**Status**: Functional

#### [ravrun](./projects/ravrun/plan.md)

Marathon / endurance training-plan generator + visualizer. Live on ravrun.com + rav.run. The plan
engine landed 2026-07-01 (Riegel paces, phased progressive-mileage generator, feasibility checker —
TDD, coverage-gated); next is the form UI + URL state replacing the hardcoded demo grid.

**Status**: Functional

#### [davidjfelix.com](./projects/davidjfelix-com/plan.md)

Minimal personal identity landing — name, bio, profile links — pointing at djf.io. Real but
intentionally small.

**Status**: Real, minimal

### Functional, gated

#### [forzamonica.com](./projects/forzamonica-com/plan.md)

Headless Shopify storefront (TanStack Start + Panda/Ark on Workers, wired against mock.shop).
Scaffold complete; production blocked on two human tasks (Shopify store + token, domain
registration) filed as issues.

**Status**: Functional · Blocked (human tasks)

#### [f311x](./projects/f311x/plan.md)

Small chat app / agent playground on Cloudflare (TanStack Start, Alchemy v2). Production restored
and verified; next is swapping the echo stub for a real model — which must sit behind auth first
(mechanism TBD).

**Status**: Functional

#### [alchemy-state-viewer](./projects/alchemy-state-viewer/plan.md)

Read-only dashboard for alchemy-effect deployment state (SvelteKit on Workers, the monorepo's
first). Browses the alchemy Cloudflare state store — stacks, stages, resource state, outputs — with
secrets masked server-side and a Basic-auth gate. Dark until the worker secrets are set.

**Status**: Functional · Blocked (human secrets)

### Placeholders (live domains; basic layout is the near-term)

#### [monicandavid.com](./projects/monicandavid-com/plan.md)

A couple's blog for Monica & David. Basic landing shipped; the actual posts are the next phase.

**Status**: Placeholder

#### [onvibes.org](./projects/onvibes-org/plan.md)

A showcase of "vibecoded" apps plus an Astro-based builder toolchain to create them. Live
placeholder; the builder's LLM must sit behind auth (mechanism TBD).

**Status**: Placeholder

#### [revision.city](./projects/revision-city/plan.md)

A centralized version-control service for managing reviews and diffs. Live placeholder; MVP shape to
be scoped.

**Status**: Placeholder

#### [startchi.com](./projects/startchi-com/plan.md)

An ecosystem for Chicago / Midwest startups — directory, signal boost, org hub, identity. Live
placeholder.

**Status**: Placeholder

#### [pkg.dog](./projects/pkg-dog/plan.md)

A focusing-lens package manager: tree-shakes published ESM/TS packages into independent parts and
republishes them so downstream users can ignore irrelevant alerts and upgrade types safely. Live
placeholder on premium domains; the deep build is a research effort.

**Status**: Placeholder

## Cross-cutting

Span every deployed app.

### [Sentry Integration](./projects/sentry-integration/plan.md)

Wire Sentry into every deployed app for crash/error monitoring. Full-fleet rollout **landed
2026-06-25** (all 11 apps; server-side on the worker apps); dark until the projects + per-app DSN
vars exist (issue #261).

**Status**: Active · Blocked (human activation)

### [PostHog Integration](./projects/posthog-integration/plan.md)

Wire PostHog into every deployed app for product analytics. Full-fleet rollout **landed 2026-06-25**
(all 11 apps reverse-proxy through `/diag`); dark until the projects + per-app key vars exist (issue
#261).

**Status**: Active · Blocked (human activation)

## Infrastructure & hygiene

Repo plumbing. Real work, but lower priority than moving the apps forward.

### [CI Pipeline Efficiency](./projects/ci-pipeline-efficiency/plan.md)

Make CI trigger only the workflows a change can affect (better path filtering, not concurrency), and
cache the steps that start cold — the pnpm store, and the blocking web-session Playwright install.

**Status**: Active

### [Renovate Rollout](./projects/renovate-rollout/plan.md)

Extend Renovate repo-wide (npm + mise + Cargo + lockFileMaintenance), pin the `latest`-tagged tsgo
deps, revisit gated auto-merge, and retire the bespoke freshness skill + cron once coverage is
proven.

**Status**: Active

### [Review Consolidation](./projects/review-consolidation/plan.md)

Consolidate the repo's code-review surfaces around **Warden** as the canonical automated PR gate,
with the built-in `/code-review` + `/security-review` (local inner loop) and `/review` (Standards +
Spec) positioned to complement it, not compete. Warden landed 2026-06-30; the gate goes live once
its secrets exist (#302). Next: encode the repo's own standards as custom Warden skills.

**Status**: Active · Blocked (human activation, #302)

### [Lint/Format Loose Ends](./projects/lint-format-loose-ends/plan.md)

The concrete residual of the closed linter-formatter standardization: format all of `docs/` + add a
Prettier guard, rename `.config/cspell.json` → `.jsonc`, and fold the legacy JS dirs into the
standard.

**Status**: Active

## Parked

Local-machine work; no agent path until David sits down at his machine.

### [Dotfiles Overhaul](./projects/dotfiles-overhaul/plan.md)

Migrate shell from omz to fish, add nushell/jj/starship config, sync local state back into repo,
audit packages.

**Status**: Parked

### [Setup Warp](./projects/setup-warp/plan.md)

Install the Warp CLI and explore using it.

**Status**: Parked

### [Update Warp Config](./projects/update-warp-config/plan.md)

Pull configuration items from dotfiles into Warp and sync Warp-native config back into the repo.
Depends on Setup Warp + Dotfiles.

**Status**: Parked
