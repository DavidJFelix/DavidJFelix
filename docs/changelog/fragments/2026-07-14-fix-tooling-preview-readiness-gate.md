### fix(tooling): gate preview smoke and screenshots behind verified edge readiness

The per-PR preview pipelines raced Cloudflare's edge propagation: `wrangler deploy` returns once the
API accepts the script, but a fresh workers.dev hostname (an isolated `<worker>-pr-<N>` Worker, or a
version preview alias on the PR's first upload) starts serving eventually -- and not monotonically,
so one lucky 200 in the smoke retries could wave Playwright through into an edge still returning
404s. onvibes.org hit this repeatedly: deploy green, every screenshot URL 404, and a plain rerun
(hostname propagated by then) green.

`bin/await-url-ready.ts` turns that race into an event. After deploy, both preview actions
(`preview-worker`, `preview-wrangler`) poll every smoke route on the preview URL until one round has
all of them serving, four consecutive rounds in a row spaced three seconds apart, bounded by a
three-minute deadline -- and only then hand off to smoke and screenshots. Sustained-success polling,
not a bigger retry budget, is what non-monotonic propagation requires: a failure restarts the
streak, so a single 200 never counts as ready, while a redeploy to an already-propagated hostname
converges in seconds. The gate probes the exact bare URLs the downstream checks fetch, with plain
requests: responses are cached per full URL, so a 404 cached during propagation can outlive it for
one route while its siblings serve fine -- cache-busted probes would sail past exactly the stale
response smoke is about to trip over. Downstream failures now always mean app bugs, never platform
lag.
