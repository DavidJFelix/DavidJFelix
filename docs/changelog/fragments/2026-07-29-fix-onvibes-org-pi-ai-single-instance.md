### fix(onvibes.org): keep pi-ai to one instance so the agent API answers again

The smoke gate has been red since the last lock-file maintenance pass: the chat agent endpoint
returned HTTP 500 with `No API provider registered for api: onvibes`, while `/` and `/chat` kept
serving fine because neither touches the agent runtime.

Nothing in the app changed. `@earendil-works/pi-ai` holds its API-transport registry in module
state, so the faux echo provider `src/app.ts` registers has to live in the same instance
`@flue/runtime` resolves models through. pnpm keys pi-ai by its resolved peer context, and
`@modelcontextprotocol/sdk` is the peer that split it -- `@flue/runtime` depends on `^1.29.0` and
landed on 1.30.0, while `@cloudflare/codemode` (via the `agents` SDK) declares a `^1.25.0` peer and
stayed on 1.29.0. Two peer contexts, two pi-ai copies, two registries: the provider was registered
in one and looked up in the other. Before the refresh both sides resolved the same copy.

Both ranges accept 1.30.0, so a pnpm override pins the sdk to a single version and pi-ai collapses
back to one instance. The lockfile gets smaller as a result.

A unit test beside `app.ts` now asserts the app and `@flue/runtime` resolve the same pi-ai
directory, canonicalized through pnpm's symlinks. It fails in under a second with both paths named,
instead of leaving the next peer split to surface as a 500 after a workerd boot -- verified by
reverting the override and watching it go red.
