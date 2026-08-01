### feat(theme): extract the theming contract into packages/theme

The hand-rolled theme core that PR 1 copied across the fleet now lives once, in a new `packages/`
top level for shared code apps consume as `file:` dependencies (each app keeps its own lockfile;
`workspaces/` remains the quarantine for colliding trees). `@davidjfelix/theme` ships raw TypeScript
via subpath exports -- the state-owning controller (`.`), the zod storage schema, mode vocabulary,
and cycle order (`./schema`), the pre-paint bootstrap and its inline-script generator
(`./bootstrap`), the React provider (`./react`), and a new vanilla DOM binding (`./toggle`) that
consolidates the four hand-written Astro toggle scripts. react and zod are peer dependencies, and
the package owns the unit tests with full coverage of the logic modules.

The four TanStack apps (f311x, ravrun, startchi.com, forzamonica.com) and four Astro apps (djf.io,
onvibes.org, calendar-visualizer, davidjfelix.com) delete their copies and consume the package;
toggle markup and styling stay app-owned. The Astro apps' pre-paint inline scripts are now generated
at build time from the typed bootstrap, so the hand-synced "compiled twin" survives only in ravrun's
`index.html`, which has no SSR host to stringify into. The SvelteKit and Nuxt apps keep mode-watcher
and @nuxtjs/color-mode pinned to the contract by configuration. A new `ci-theme.yml` gates the
package, every consumer's CI/CD workflow retriggers on `packages/theme/**`, the session-start hook
installs `packages/` alongside `apps/`, and the spell gate covers the new tree. Verified by each
app's typecheck, unit, and build gates plus the theme e2e suites.
