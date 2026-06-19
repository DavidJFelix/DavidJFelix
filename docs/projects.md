# Projects

Ongoing projects and their documentation.

Grouped by status, and within **Active**, ordered by priority. Reconciled 2026-06-18 (the prior
2026-06-11 priority tiers were overtaken by the f311x prod restore and the repo-wide preview
rollout). Status legend:

- **Active** — in flight or next-up, agent-doable now
- **Blocked** — waiting on an external/human dependency (account, credential, another project)
- **Parked** — needs David at a local machine; no agent path
- **Deferred** — intentionally not now

## Active

### [f311x.com](./projects/f311x/plan.md)

A small chat app on Cloudflare (TanStack Start, Alchemy v2). Production is restored and verified;
the live work is swapping the echo stub for a real model and getting Worker error visibility (via
the Sentry rollout, which f311x leads).

**Status**: Active

### [CI Pipeline Efficiency](./projects/ci-pipeline-efficiency/plan.md)

Make CI trigger only the workflows a change can affect (better path filtering, not concurrency), and
cache the steps that start cold — the pnpm store, and the blocking web-session Playwright install.

**Status**: Active

### [Renovate Rollout](./projects/renovate-rollout/plan.md)

Extend Renovate repo-wide (npm + mise + Cargo + lockFileMaintenance), pin the `latest`-tagged tsgo
deps, revisit gated auto-merge, and retire the bespoke freshness skill + cron once coverage is
proven. Respawn of the closed dependency-freshness project.

**Status**: Active

### [Lint/Format Loose Ends](./projects/lint-format-loose-ends/plan.md)

The concrete residual of the closed linter-formatter standardization: format all of `docs/` + add a
Prettier guard, rename `.config/cspell.json` → `.jsonc`, and fold the legacy JS dirs into the
standard (low priority). Rust is scoped out.

**Status**: Active

### [Sentry Integration](./projects/sentry-integration/plan.md)

Wire Sentry into every deployed app for crash/error monitoring. Full-fleet rollout; f311x leads (it
needs Worker error visibility).

**Status**: Active

### [PostHog Integration](./projects/posthog-integration/plan.md)

Wire PostHog into every deployed app for product analytics. Full-fleet rollout, back-to-back with
Sentry.

**Status**: Active

### [Blog Content](./projects/blog-content/plan.md)

Begin writing djf.io blog posts (the words, distinct from the style project). First up: "attention
is all you need" — a callback to the Transformer paper, on utilizing LLMs in your work.

**Status**: Active

### [Blog Style Improvement](./projects/blog-style-improvement/plan.md)

Human-directed visual/UX polish of djf.io: colors, spacing, layout, images, usability, components.
David is driving specific changes now; per-PR preview URLs feed the loop.

**Status**: Active

## Blocked

### [Forza Monica Shop](./projects/forzamonica-shop/plan.md)

Headless Shopify storefront for forzamonica.com (TanStack Start + PandaCSS + Ark UI on Workers,
wired against mock.shop). Scaffold complete; production blocked on two human tasks (Shopify store +
token, domain registration) filed as issues.

**Status**: Blocked

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

## Deferred

### [LLM Automation Migration](./projects/llm-automation-migration/plan.md)

Move unattended LLM-driven GitHub Actions off Anthropic-billed Claude onto a cheaper runtime. Now
scoped to `bot-claude-code-review.yml` alone (the freshness cron is being retired by
renovate-rollout).

**Status**: Deferred
