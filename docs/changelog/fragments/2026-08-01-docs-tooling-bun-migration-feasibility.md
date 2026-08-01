### docs(tooling): bun migration feasibility study

A hands-on spike answered what it would take to move the apps from pnpm to bun (1.3.11). All 12 apps
install, build, and unit-test green under `bun install` in scratch copies -- every framework family,
including djf.io's sharp/satori/pagefind build, onvibes.org's flue worker, and f311x's
alchemy/effect beta tree -- and davidjfelix.com's full Playwright e2e suite passed against the
bun-installed tree with `wrangler dev` booting workerd. Bun migrates `pnpm-lock.yaml` faithfully
(resolutions and overrides preserved, nothing bumped), runs `prepare` scripts, and supports
`--frozen-lockfile` straight off the pnpm lockfile.

The sharp edges are recorded in `docs/projects/bun-migration/plan.md` alongside the mechanical
inventory: `trustedDependencies` replaces bun's default trust list rather than extending it, the
release-age cooldown (`minimumReleaseAge`) is off by default and per-app because `bunfig.toml` is
not inherited, and `bun test` cannot replace vitest yet (no `vi.stubGlobal`/`vi.resetModules`, no
jsdom environment, no branch coverage metric). Execution is gated on amending the tooling standard;
until then the project sits in the index as deferred.
