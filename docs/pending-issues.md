# Pending GitHub Issues

Drafts of GitHub issues that need to be filed against `DavidJFelix/DavidJFelix` and assigned to `@DavidJFelix`. The GitHub MCP server was disconnected when these were drafted; cut them via MCP when it's back, then delete this file.

Format follows the [Human Intervention Tasks](../CLAUDE.md#human-intervention-tasks) section of `CLAUDE.md`.

---

## Issue: Install the Warp CLI on local machine

**Assignee:** @DavidJFelix
**Labels:** human-intervention, setup-warp

### Background

The `setup-warp` project is gated on the Warp CLI being installed locally. The agent can't install a desktop terminal app for you. Once installed, exploration of features (agents, blocks, sessions, AI, command palette) can proceed.

### Steps

- [ ] Download the Warp CLI from https://www.warp.dev/
- [ ] Install it via the platform-appropriate method (Homebrew cask, official installer, etc.)
- [ ] Verify the install: run `warp --version` in a terminal
- [ ] Launch Warp once to complete first-run setup (auth, telemetry choice)
- [ ] Comment on this issue with the install method used, so it can be captured in `dotfiles/Brewfile` or equivalent

### Automation follow-up

Once we know which install method we're standardizing on, add it to `dotfiles/Brewfile` (or the equivalent package list) so it's reproducible across machines. Track that work under [Update Warp Config](docs/projects/update-warp-config/plan.md).

### Related

- [Setup Warp](docs/projects/setup-warp/plan.md)
- [Update Warp Config](docs/projects/update-warp-config/plan.md) (blocked on this)

---

## Issue: Create Sentry org and per-app projects

**Assignee:** @DavidJFelix
**Labels:** human-intervention, sentry-integration

### Background

The `sentry-integration` project can't ship a pattern until there's a Sentry org and at least one project to point at. Account creation, billing, and org/project structure require your login — the agent can't do this. Picking the layout now (one project per app vs. one project with environments) blocks the rollout pattern for every other app.

### Steps

- [ ] Sign in / sign up at https://sentry.io
- [ ] Create or confirm the org (e.g. `davidjfelix`)
- [ ] Decide the project layout: one Sentry project per app, or one project with environments per app. Note the decision in `docs/projects/sentry-integration/`.
- [ ] Create the first project for `djf.io` as the pilot
- [ ] Copy the DSN into a password manager entry (do NOT paste it here)
- [ ] Comment on this issue with: org slug, project slug, and confirmation the DSN is stashed

### Automation follow-up

Once the pilot pattern is proven on djf.io, the per-app wire-up (SDK install, source map upload, release tagging in CI) can be scripted into a reusable skill so additional apps go in with one command. File that as a follow-up under `sentry-integration`.

### Related

- [Sentry Integration](docs/projects/sentry-integration/plan.md)
- Parallel: [PostHog Integration](docs/projects/posthog-integration/plan.md)

---

## Issue: Create PostHog org and per-app projects

**Assignee:** @DavidJFelix
**Labels:** human-intervention, posthog-integration

### Background

Same shape as the Sentry task: the `posthog-integration` rollout can't pick a per-app pattern until there's a PostHog org/project to wire into. Account creation and project layout decisions need your login.

### Steps

- [ ] Sign in / sign up at https://posthog.com (or self-host — note the choice)
- [ ] Create or confirm the org
- [ ] Decide layout: one project per app, or one project with `app` as a property. Note the decision in `docs/projects/posthog-integration/`.
- [ ] Create the first project for `djf.io` as the pilot
- [ ] Copy the project API key into a password manager entry
- [ ] Comment on this issue with: org slug, project slug, hosting choice (cloud vs. self-host)

### Automation follow-up

After the djf.io pilot, the per-app wire-up (SDK install, identify/capture conventions, autocapture toggles) becomes a reusable skill. File that as a follow-up.

### Related

- [PostHog Integration](docs/projects/posthog-integration/plan.md)
- Parallel: [Sentry Integration](docs/projects/sentry-integration/plan.md)

---

## Issue: DNS cutover for davidjfelix.com

**Assignee:** @DavidJFelix
**Labels:** human-intervention, new-domain-sites

### Background

`apps/davidjfelix.com/` is scaffolded and the Cloudflare Workers deploy workflow is in place, but `wrangler.toml` is intentionally missing the `routes` entry because the domain isn't pointed at the Worker yet. DNS records live in Cloudflare and changing them requires your login. Without this, the site is deployed but unreachable at the apex domain.

### Steps

- [ ] Log into Cloudflare → `davidjfelix.com` zone
- [ ] Confirm the Worker for `davidjfelix-com` is deployed and reachable at its `*.workers.dev` URL
- [ ] In the Worker → Settings → Triggers (or via wrangler), attach `davidjfelix.com` and `www.davidjfelix.com` as custom domains
- [ ] Verify DNS resolves and HTTPS serves the site from the apex
- [ ] Add the `routes` block with `custom_domain = true` to `apps/davidjfelix.com/wrangler.toml` so it's reproducible from config
- [ ] Comment on this issue with the timestamp of cutover

### Automation follow-up

Codify the custom-domain attachment in `wrangler.toml` so future redeploys don't drift. After this cutover, document the pattern in `new-domain-sites` so the next 7 domains follow the same wrangler-config-first approach instead of dashboard clicks.

### Related

- [New Domain Sites](docs/projects/new-domain-sites/plan.md)
- `apps/davidjfelix.com/wrangler.toml`
- Latest progress: `docs/projects/new-domain-sites/2026-04-30-progress.md`
