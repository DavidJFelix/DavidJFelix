### feat(alchemy-state-viewer): read-only web viewer for alchemy deployment state

New app `apps/alchemy-state-viewer` -- the monorepo's first SvelteKit app (Svelte 5, cloudflare
adapter) -- presenting alchemy-effect Infrastructure-as-Effects state in the browser. It proxies the
alchemy Cloudflare state store's HTTP API server-side and renders stacks, stages, per-resource state
(props, attributes, bindings, downstream edges, replacement backlog, action rows), and stack
outputs, with status summaries per stage.

Security posture: the state-store bearer token lives only in worker secrets (`ALCHEMY_STATE_TOKEN`);
persisted secrets (`__redacted__` envelopes) are masked server-side so they never reach the browser;
and the app does no authentication of its own -- the deployed worker sits behind Cloudflare Access,
enabled on its workers.dev route before the secrets are set. Unconfigured, it renders setup
instructions instead of erroring, keeping the smoke gate deterministic and secret-free.

Ships with the standard app rig: mise check tasks, oxlint + biome + oxfmt clean, vitest unit tests
with a v8 coverage ratchet on `src/lib`, a `smoke` task that boots the built worker in
`wrangler dev` and probes it, CI (`ci-alchemy-state-viewer.yml`), and CD deploying to workers.dev
(`cd-deploy-alchemy-state-viewer.yml`). Per-PR previews are deferred to the parked
`alchemy-state-viewer-previews` project: the shared `preview-wrangler` action requires a Playwright
screenshot suite this app does not have yet.
