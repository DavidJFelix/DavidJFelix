### fix(tooling): gate preview smoke and screenshots behind verified edge readiness

The per-PR preview pipelines raced Cloudflare's edge propagation: `wrangler deploy` returns once the
API accepts the script, but a fresh workers.dev hostname (an isolated `<worker>-pr-<N>` Worker, or a
version preview alias on the PR's first upload) starts serving eventually -- and not monotonically,
so one lucky 200 in the smoke retries could wave Playwright through into an edge still returning
404s. onvibes.org hit this repeatedly: deploy green, every screenshot URL 404, and a plain rerun
(hostname propagated by then) green.

`bin/await-url-ready.ts` turns that race into an event. After deploy, both preview actions
(`preview-worker`, `preview-wrangler`) poll the preview URL until it serves four consecutive
successes spaced three seconds apart -- cache-busted, status-transition logging, bounded by a
three-minute deadline -- and only then hand off to smoke and screenshots. Sustained-success polling,
not a bigger retry budget, is what non-monotonic propagation requires: a failure after a success
restarts the streak, so a single 200 never counts as ready, while a redeploy to an
already-propagated hostname converges in seconds. Downstream failures now always mean app bugs,
never platform lag.
