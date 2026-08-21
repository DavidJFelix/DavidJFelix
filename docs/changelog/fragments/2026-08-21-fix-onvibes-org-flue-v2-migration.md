### fix(onvibes.org): migrate to flue 2

Renovate's `@flue/*` v2 bump landed a breaking framework redesign, so the app moved with it. The
`flue build`/`flue dev` CLI is gone: the worker now builds through Vite (`@flue/vite` plus
`@cloudflare/vite-plugin`, new `vite.config.ts`, `flue.config.ts` deleted), still emitting to
`dist-flue/onvibes_org/` so CD and the smoke/e2e boots keep their paths. The agent became a
`'use agent'` function (`Assistant` with `useModel`; `defineAgent` and the `route` export are gone)
mounted explicitly in `app.ts` via `createAgentRouter` at the old `/api/agents/assistant` path, and
provider registration moved to Pi's `fauxProvider` + `setProvider` (pi-ai aligned to 0.83.0 to keep
one copy -- the app.test.ts guard). The React island now uses the conversation-scoped
`useFlueAgent({url})` (`FlueProvider` is gone), and the smoke gate speaks the new protocol through
`@flue/sdk`'s `send()`/`read()` since the synchronous `?wait=result` POST was removed. Local
`wrangler dev` boots pin `--local-upstream` so the runtime-built `streamUrl` stays on the local
origin instead of the configured onvibes.org route, and the wrangler migrations retire the beta-era
`FlueRegistry`/`FlueAssistantAgent` classes (Flue 2's schema reset rejects beta Durable Object
databases) before recreating the agent class fresh.
