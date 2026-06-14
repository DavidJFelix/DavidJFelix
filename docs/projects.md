# Projects

Ongoing projects and their documentation.

Active work is grouped and ordered by priority (reprioritized 2026-06-11). Dev environment projects run async to the main sequence.

## Priority 1 — App Health & Preview Infrastructure

f311x is broken in production despite green CI and a successful deploy. Restoring it — and building the preview/observability infrastructure that makes that class of breakage visible — is the current top concern.

### [f311x.com](./projects/f311x/plan.md)

A small chat app on Cloudflare — TanStack Start front end, deployed via Alchemy v2. Currently broken in production (reported 2026-06-11); diagnose and restore first, then swap the echo stub for a real model.

**Status**: In Progress

### [Preview Deployments & Visual Testing](./projects/preview-deployments/plan.md)

Per-PR preview deployments, smoke tests, and screenshot testing for every deployed web app, so breakage is visible at review time instead of in production. Also the new bar for dependency auto-merge. f311x is the proving ground.

**Status**: In Progress

### [Testing Harness & Code-Quality Safety Net](./projects/testing-harness/plan.md)

A layered, fast safety net (unit -> smoke -> e2e -> coverage) that also runs inside Claude Code on the web, not just CI. Phase 0 (web-session bootstrap hook) is done; smoke-test pull-forward, generalization, unit-test backfill, and a repo-wide coverage gate follow. Complements preview-deployments (preview infra) and sentry-integration (diagnosis).

**Status**: In Progress

## Priority 2 — Monorepo Hygiene

### [Linter & Formatter Standardization](./projects/linter-formatter-standardization/plan.md)

Converge on a single, consistent set of linters and formatters across the entire monorepo with clear tool-to-file-type ownership. A 2026-06-11 audit found 2–4 sessions of real work remaining (Rust at 0%, cspell unwired, unscoped directories); three scope decisions pending.

**Status**: In Progress

### [Dependency Freshness](./projects/dependency-freshness/plan.md)

mise-based versioning and an ongoing process to keep packages across the monorepo current. Renovate now owns all ecosystems (npm, mise, Cargo); gated auto-merge is deprioritized and waits on preview verification plus real test suites.

**Status**: In Progress

### [LLM Automation Migration](./projects/llm-automation-migration/plan.md)

Move unattended LLM-driven GitHub Actions off Anthropic-billed Claude onto a cheaper runtime. Deferred — not a now thing; scope shrinks if Renovate replaces the freshness cron.

**Status**: Deferred

## Priority 3 — djf.io Cluster

### [Blog Style Improvement](./projects/blog-style-improvement/plan.md)

Human-directed polish of djf.io: colors, spacing, layout, images, usability, components. Advances when David sits down to direct; preview URLs from the preview-deployments project will feed this workflow.

**Status**: In Progress

## Priority 4 — Greenfield

### [Forza Monica Shop](./projects/forzamonica-shop/plan.md)

Headless Shopify storefront for forzamonica.com — TanStack Start + PandaCSS + Ark UI on Cloudflare Workers, wired against mock.shop until the real store exists. Scaffold complete; production blocked on Shopify/Cloudflare account setup (issues filed).

**Status**: In Progress

## Priority 5 — Cross-App Instrumentation

Similar shape of work; do them back-to-back once apps exist. The f311x slice of Sentry may be pulled forward as part of Priority 1 (production observability for the broken app).

### [Sentry Integration](./projects/sentry-integration/plan.md)

Wire Sentry into every app in the repo for crash and error monitoring.

**Status**: In Progress

### [PostHog Integration](./projects/posthog-integration/plan.md)

Wire PostHog into every app in the repo for product analytics.

**Status**: In Progress

## Async — Dev Environment

Run in parallel to the main sequence; not on the critical path.

### [Dotfiles Overhaul](./projects/dotfiles-overhaul/plan.md)

Migrate shell from omz to fish, add nushell/jj/starship config, sync local state back into repo, audit packages.

**Status**: In Progress

### [Setup Warp](./projects/setup-warp/plan.md)

Install the Warp CLI and explore using it.

**Status**: In Progress

### [Update Warp Config](./projects/update-warp-config/plan.md)

Pull configuration items from dotfiles into Warp and sync Warp-native config back into the repo.

**Status**: In Progress
