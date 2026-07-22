# alchemy-state-viewer

A read-only dashboard for alchemy-effect Infrastructure-as-Effects state -- SvelteKit on Cloudflare
Workers, browsing the alchemy Cloudflare state store's HTTP API (stacks, stages, resource state,
stack outputs). Panda CSS for styling, Ark UI (Svelte) for components (JSON tree views, collapsible
sections).

## Current state (2026-07-21)

- **Functional.** Stacks -> stages -> resources -> detail navigation, status summaries, stack
  outputs, action rows (`kind: "action"`), and replacement/`old` state all render. Secrets in
  persisted state (`__redacted__` envelopes) are masked server-side before anything reaches the
  browser; `__duration__` envelopes render human-readable.
- **Guarded.** The state-store bearer token stays server-side (`ALCHEMY_STATE_TOKEN` worker secret).
  The app does no authentication of its own -- the deployed worker sits behind Cloudflare Access on
  its workers.dev route. Unconfigured it serves setup instructions, which keeps the smoke gate
  secret-free.
- **Gated + wired.** Unit tests with a v8 coverage ratchet on `src/lib`, a `smoke` task booting the
  built worker in `wrangler dev`, CI (`ci-alchemy-state-viewer.yml`), and CD
  (`cd-deploy-alchemy-state-viewer.yml`, plain `wrangler deploy` to workers.dev).

## Next

- [ ] Human: after the first deploy, enable Cloudflare Access on the worker's workers.dev route,
      THEN configure the state store: fill in `store_id` on the `ALCHEMY_STATE_TOKEN_SECRET` binding
      in `wrangler.toml` (`wrangler secrets-store store list`) and
      `wrangler secret put ALCHEMY_STATE_URL`. Access must come first -- the app has no auth of its
      own. The token itself is never copied: the binding reads the `AlchemyStateStoreToken` secret
      alchemy already keeps in the account Secrets Store.
- [ ] Per-PR previews: spun out to
      [alchemy-state-viewer-previews](../alchemy-state-viewer-previews/plan.md) (parked -- needs a
      minimal Playwright suite first, and preview versions inherit the worker's secrets and Access
      posture).
- [ ] Possible niceties once real state is browsable: filter/search over FQNs, surfacing
      `getReplacedResources` cleanup backlog, linking downstream FQNs across stages.

**Status**: Functional
