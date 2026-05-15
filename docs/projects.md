# Projects

Ongoing projects and their documentation.

Active work is grouped and ordered by priority. Dev environment projects run async to the main sequence.

## Priority 1 — Monorepo Hygiene

Foundation work. Stabilize the toolchain before piling new features on top.

### [Dependency Freshness](./projects/dependency-freshness/plan.md)

mise-based versioning and an ongoing process (skill + cadence) to keep packages across the monorepo current.

**Status**: In Progress

### [Linter & Formatter Standardization](./projects/linter-formatter-standardization/plan.md)

Converge on a single, consistent set of linters and formatters across the entire monorepo with clear tool-to-file-type ownership.

**Status**: In Progress

### [LLM Automation Migration](./projects/llm-automation-migration/plan.md)

Move unattended LLM-driven GitHub Actions (freshness cron, PR review) off Anthropic-billed Claude onto a cheaper runtime (pi-core on bun, or opencode).

**Status**: In Progress

## Priority 2 — djf.io Cluster

All touching the same app; sequence together.

### [Blog Style Improvement](./projects/blog-style-improvement/plan.md)

Human-directed polish of djf.io: colors, spacing, layout, images, usability, components.

**Status**: In Progress

### [djf.io Search](./projects/djf-io-search/plan.md)

Add Pagefind static search to djf.io with a PandaCSS-styled UI and Cmd/Ctrl+K shortcut.

**Status**: In Progress

### [djf.io SEO & Polish](./projects/djf-io-seo/plan.md)

SEO meta, Open Graph images, sitemap, JSON-LD, Lighthouse >90 for djf.io.

**Status**: In Progress

## Priority 3 — Greenfield

### [New Domain Sites](./projects/new-domain-sites/plan.md)

Stand up sites for 8 owned domains across Astro, TanStack Start, Vue, and SvelteKit.

**Status**: In Progress

## Priority 4 — Cross-App Instrumentation

Similar shape of work; do them back-to-back once apps exist.

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

### [Setup Hermes](./projects/setup-hermes/plan.md)

Set up Hermes.

**Status**: In Progress

### [Setup OpenClaw](./projects/setup-openclaw/plan.md)

Set up OpenClaw.

**Status**: In Progress

### [Setup Warp](./projects/setup-warp/plan.md)

Install the Warp CLI and explore using it.

**Status**: In Progress

### [Update Warp Config](./projects/update-warp-config/plan.md)

Pull configuration items from dotfiles into Warp and sync Warp-native config back into the repo.

**Status**: In Progress
