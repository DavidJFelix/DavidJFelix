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
