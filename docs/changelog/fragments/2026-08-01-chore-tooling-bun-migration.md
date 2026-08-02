### chore(tooling): migrate the apps from pnpm to bun

All 12 apps and the shared `packages/theme` package now use bun as package manager and script
runner. A hands-on feasibility spike ran first (bun 1.3.11): every app was installed, built, and
unit-tested from scratch under bun in scratch copies, and davidjfelix.com's full Playwright e2e
suite passed against the bun-installed tree with `wrangler dev` booting workerd. Bun's lockfile
migration proved faithful -- resolutions and overrides carried over from `pnpm-lock.yaml` with
nothing bumped -- so the committed `bun.lock` files pin exactly what pnpm had resolved. Vitest stays
the test runner (bun's compat shim lacks `vi.stubGlobal`/`vi.resetModules`, a jsdom environment, and
branch coverage), invoked via `bun run test`; node remains the toolchain runtime for vitest,
Playwright, wrangler, and the framework CLIs.

The pnpm-specific machinery moved wholesale: `pnpm-workspace.yaml` `allowBuilds` became explicit
per-app `trustedDependencies` (declaring the field replaces bun's default trust list, so each app
names its full allowlist -- esbuild, workerd, sharp, `@sentry/cli` where sourcemaps upload),
overrides moved into package.json (djf.io's rolldown pin, f311x's alchemy/effect pins, onvibes.org's
MCP SDK dedupe pin, with rationale comments preserved in each app's `bunfig.toml`), and every
project gained a `bunfig.toml` setting `minimumReleaseAge = 86400` -- bun's release-age cooldown is
off by default and not inherited, so the per-project file is what keeps the supply-chain cooldown
pnpm used to enforce. One behavioral difference worth knowing: bun installs a `file:` dependency's
devDependencies where pnpm pack-installed without them, so consuming apps carry a nested copy of the
theme package's dev tooling -- verified harmless (all four React consumers pass e2e against built
apps; bundles carry a single React) but it is the first thing to check if a theme-consuming app
misbehaves. All 27 Depot workflows and the three composite actions now run
`bun install --frozen-lockfile` and `bun x`; the session-start hook, preview/deploy `bin/` scripts,
and app smoke scripts spawn bun; the pnpm pin left `.config/mise.toml`; and the tooling standard,
AGENTS.md, and app docs were swept. The two legacy `workspaces/joy-of-react` trees keep pnpm
lockfiles and migrate when next touched.
