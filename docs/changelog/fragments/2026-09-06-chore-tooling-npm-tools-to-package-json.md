### chore(tooling): pin the npm CLIs in a repo-root package.json instead of mise

Every npm-distributed tool that `.config/mise.toml` used to install through mise's npm and aqua
backends -- biome, oxlint, oxfmt, prettier, cspell and its JUnit reporter, warden, the pi coding
agent, turbo -- is now an exact-version devDependency of a new repo-root `package.json`, installed
by `bun install` at the root and locked by a root `bun.lock`. The root `bunfig.toml` carries the
same 24-hour release-age cooldown as the workspace and selects bun's isolated linker, so only the
tools themselves sit at the top of the root `node_modules`: Node's upward walk from an app must
never find one of their transitive dependencies there (the first preview run did, and astro's
prerender step got warden's CommonJS `cookie` instead of its own). mise keeps the runtimes (node,
bun) and the non-npm CLIs (actionlint, ghalint, zizmor, pinact, depot, worktrunk);
`.config/mise.lock` lost the npm entries. Keeping the versions consistent had become the hard part:
the same tools were pinned in three places under two managers.

The root config adopts the mise Node.js cookbook's `[env] _.path` directive, so the root
`node_modules/.bin` is on PATH in every activated shell and every `mise run` / `mise exec`, the way
the shims were; `bun run` inside an app already walks up to the repo root on its own, so the apps'
`lint` and `format` scripts resolve the same copies without activation. `bin/turbo-run.ts` and
`bin/plan-affected-apps.ts` reach turbo the same way, with `bun run turbo` from the workspace, so
the preview and deploy planning jobs (which install only the root, never the workspace) keep
working. The turbo cache key now also hashes the root `package.json` and `bun.lock`.

The web-apps workspace catalog grew to cover the shared dev tooling -- vitest and its coverage and
browser packages, Playwright, wrangler, vite and its React plugin, the oxlint plugins, `@types/bun`,
`@types/node`, the React types, jsdom, Panda, the Cloudflare vite plugin and worker types,
svelte-check -- and every app and package references them as `catalog:`. The two pnpm trees under
`workspaces/joy-of-react/` got a `catalog:` block in `pnpm-workspace.yaml` for their tooling (biome,
oxlint, cspell, parcel, rimraf) and refreshed lockfiles. The `packageManager` pin in the workspace
now matches the mise-pinned bun (1.4.2).

CI: `setup-mise` runs a frozen `bun install` at the repo root after the mise install, so a stale
root lockfile fails the job; the workflows whose paths filters listed the mise lockfile also list
the root `package.json` and `bun.lock`; the `spell:ci` task passes the JUnit reporter by package
name instead of a `mise where` path. The session-start hook installs the root package before the
workspace. Renovate's cross-manager groups (sentry, earendil, oxc, biome, cspell) dropped their
`npm:` mise names; the oxc group now also carries `oxlint-tsgolint`.
