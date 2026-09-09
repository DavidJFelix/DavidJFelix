### fix(deps): update @astrojs/cloudflare to 14.3.0 and astro to 7.3

Renovate's `@astrojs/cloudflare` 14.3.0 bump failed every Astro app build with
`"renderForPrerender" is not exported by astro/dist/core/app/entrypoints/index.js`. The adapter's
new prerender worker imports `renderForPrerender` from `astro/app`, an export Astro added in 7.3.0,
but the adapter still declares `astro: ^7.2.0` as its peer range, so `bun.lock` kept Astro at 7.2.6
and the import resolved to nothing. The peer range is the bug upstream; here the fix is to raise the
`astro` spec in `calendar-visualizer`, `davidjfelix.com`, and `djf.io` from `^7.0.0` to `^7.3.0` so
the lockfile resolves 7.3.2. The lock diff is Astro plus its own transitive deps
(`@astrojs/internal-helpers`, the markdown renderer, `find-process` to `find-proc`), nothing else.

While fixing it, the web session-start hook rewrote both `bun.lock` files with unrelated bumps: its
`bun install --frozen-lockfile` attempt failed transiently, and the hook fell back to a plain
`bun install`, which re-resolves. The hook now installs frozen only, retrying frozen once for a
registry blip and warning on failure, so a session always sees the committed tree and any lockfile
drift is a visible change for the agent to fix on purpose.

The first green build then failed the djf.io e2e job: 28 tests passed, the `wrangler dev` web server
printed a bare `[ERROR]` line and exited, and the remaining 22 tests got `ERR_CONNECTION_REFUSED`.
The Playwright report shows the worker stalling right after the Sentry tunnel tests (a 7.8 s home
page load that normally takes 0.1 s) before dying. Ten reruns of the job on Depot against the same
tree, fresh-build and cache-hit alike, all passed 50/50, and a five-minute local soak of the same
`wrangler dev` boot never exited, so it is a rare flake with no root cause yet: wrangler's debug log
held the answer and CI discarded it. The e2e job now uploads `~/.config/.wrangler/logs` as a
`wrangler-logs` artifact whenever it fails, so the next occurrence can be diagnosed instead of
retried.
