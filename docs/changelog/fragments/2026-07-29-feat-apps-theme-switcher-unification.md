### feat(apps): unify theme switching across the fleet behind one contract

Every app now handles light/dark/system color schemes the same way, at the quality bar
revision.city's diffs theming set: one localStorage key (`theme`, values `light`/`dark`/`system`,
absent means system), the resolved scheme as a `light`/`dark` class on `<html>` plus
`style.colorScheme` and a `data-theme-mode` attribute, a pre-paint inline script so no page ever
flashes the wrong scheme, live OS-preference tracking while in system mode, cross-tab sync via the
`storage` event, and an accessible cycling toggle (light to dark to system) whose label names the
mode it will switch to. The contract and the survey that produced it live in
`docs/projects/theme-switcher-unification/plan.md`.

Per stack: the TanStack apps (f311x, ravrun, forzamonica.com, startchi.com) get a hand-rolled
`src/theme/` module -- a typed bootstrap stringified into the inline script, a vanilla controller
owning mode state, a thin React provider, and a toggle -- with f311x as the canonical copy and unit
plus e2e coverage. The SvelteKit apps (alchemy-state-viewer, monicandavid.com) adopt `mode-watcher`
configured to the shared key; the Nuxt app (pkg.dog) adopts `@nuxtjs/color-mode` plus a small client
plugin closing its cross-tab gap. The Astro apps (djf.io, onvibes.org, calendar-visualizer) share an
inline bootstrap and a tri-state toggle component; djf.io's existing two-state toggle gains its
missing pieces (system re-selectable, `color-scheme`, live OS tracking, guarded storage, padded hit
target, tests) and its Panda condition moves from `[data-theme=dark]` to the standard `.dark` class.
revision.city itself picks up the one contract feature it lacked, cross-tab sync.

Apps that were light-only (forzamonica.com, startchi.com, monicandavid.com, pkg.dog, onvibes.org,
calendar-visualizer) get conservative first-pass dark palettes through Panda semantic tokens (or
`light-dark()` in onvibes.org's chat stylesheet), flagged in the plan doc for design review.
davidjfelix.com, dark-only until now, gets a light palette through `light-dark()` variables and the
same bootstrap and toggle. A follow-up PR extracts the hand-rolled core into a standalone package.
