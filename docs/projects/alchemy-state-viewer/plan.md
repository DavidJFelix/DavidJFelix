# alchemy-state-viewer

A read-only dashboard for alchemy-effect Infrastructure-as-Effects state -- SvelteKit on Cloudflare
Workers, browsing the alchemy Cloudflare state store's HTTP API (stacks, stages, resource state,
stack outputs). The first SvelteKit app in the monorepo.

## Current state (2026-07-21)

- **Functional.** Stacks -> stages -> resources -> detail navigation, status summaries, stack
  outputs, action rows (`kind: "action"`), and replacement/`old` state all render. Secrets in
  persisted state (`__redacted__` envelopes) are masked server-side before anything reaches the
  browser; `__duration__` envelopes render human-readable.
- **Guarded.** The state-store bearer token stays server-side (`ALCHEMY_STATE_TOKEN` worker secret).
  The viewer itself gates every request behind HTTP Basic auth when `APP_PASSWORD` is set;
  unconfigured it serves setup instructions, which keeps the smoke gate secret-free.
- **Gated + wired.** Unit tests with a v8 coverage ratchet on `src/lib`, a `smoke` task booting the
  built worker in `wrangler dev`, CI (`ci-alchemy-state-viewer.yml`), and CD
  (`cd-deploy-alchemy-state-viewer.yml`, plain `wrangler deploy` to workers.dev).

## Next

- [ ] Human: set the worker secrets (`ALCHEMY_STATE_URL`, `ALCHEMY_STATE_TOKEN`, `APP_PASSWORD`)
      after the first deploy so the viewer reads the real state store.
- [ ] Per-PR previews: the shared `preview-wrangler` action requires a Playwright screenshot suite;
      add a minimal e2e suite and a `cd-preview-alchemy-state-viewer.yml` when previews earn their
      keep.
- [ ] Possible niceties once real state is browsable: filter/search over FQNs, surfacing
      `getReplacedResources` cleanup backlog, linking downstream FQNs across stages.

**Status**: Functional
