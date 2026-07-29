# Theme Switcher Unification

## Status

**Active** (2026-07-29) -- PR 1 in flight: bring every app's color-scheme switching up to the
revision.city quality bar behind one shared contract. PR 2 (extract a standalone package or
packages) follows once the contract has proven itself in situ.

## Goal

Every app in `apps/` handles light/dark/system color schemes the same way: same storage key, same
DOM contract, same pre-paint no-flash bootstrap, same accessibility semantics. revision.city's diffs
theming (built on `@pierre/theming`) is the quality reference; the reusable subset of it --
tri-state mode, not the Shiki theme catalog -- becomes the repo-wide standard.

## Where each app stood (2026-07-29 survey)

| App                  | Stack                          | Before                                                                                                                                                         |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| revision.city        | TanStack Start                 | Reference: pre-paint bootstrap, `@pierre/theming` controller, provider, tri-state UI. Missing cross-tab sync                                                   |
| f311x                | TanStack Start + Tailwind      | Full shadcn dark palette shipped dead: `@custom-variant dark` class-gated, nothing set the class, no system fallback                                           |
| ravrun               | TanStack Router SPA + Tailwind | Passive `prefers-color-scheme` only; correct but no user override                                                                                              |
| forzamonica.com      | TanStack Start + Panda         | Light only; no dark tokens                                                                                                                                     |
| startchi.com         | TanStack Start + Panda         | Light only; empty Panda theme, raw `white` body                                                                                                                |
| djf.io               | Astro + Panda                  | Real toggle, but two-state (system unreachable after first click), `data-theme` attribute, no live OS tracking, no `color-scheme`, unguarded storage, no tests |
| davidjfelix.com      | Astro                          | Deliberately dark-only, sets `color-scheme: dark` (the only app that did)                                                                                      |
| onvibes.org          | Astro + Panda                  | Light only; chat.css hardcodes ~30 light hex literals                                                                                                          |
| calendar-visualizer  | Astro + Panda + React island   | Light only; raw stone/white tokens in the island                                                                                                               |
| alchemy-state-viewer | SvelteKit + Panda              | Full semantic palette via `_osDark`; passive only, no override                                                                                                 |
| monicandavid.com     | SvelteKit + Panda              | Light only; empty Panda theme                                                                                                                                  |
| pkg.dog              | Nuxt + Panda                   | Light only; empty Panda theme                                                                                                                                  |

Ecosystem research (verified against source, 2026-07): `mode-watcher` 1.1.0 is the SvelteKit answer
(shadcn-svelte's pick; FOUC script, `color-scheme`, tri-state, live OS tracking, cross-tab sync);
`@nuxtjs/color-mode` 4.0.1 is the Nuxt answer (Nuxt UI's pick; injected head script, bare `.dark`
class by default, no cross-tab sync -- add a small storage listener). No framework-agnostic core
worth adopting exists; `next-themes` is React-only and Ark UI has no color-mode primitive.

## The contract

1. **Modes**: `light` | `dark` | `system`; default `system`; system stays re-selectable.
2. **Storage**: `localStorage` key **`theme`**, values `light`/`dark`/`system`; absent or invalid
   means `system`. All reads/writes wrapped in try/catch. (revision.city and djf.io already used
   this key -- no saved preference is orphaned.)
3. **DOM application**: resolved scheme as a **class on `<html>`** (`light` or `dark`), plus
   `style.colorScheme` = resolved scheme, plus `data-theme-mode` = raw mode (lets CSS style
   tri-state toggle UIs without JS state). Panda apps use the built-in `_dark` (`.dark &`)
   condition; Tailwind apps use `@custom-variant dark (&:is(.dark *))`.
4. **No flash**: an inline head script applies the contract before first paint. It is authored as a
   typed, testable function and stringified into the script (revision.city's trick), parameterized
   with `{storageKey, themeColors?}` instead of hardcoded literals.
5. **Live behavior**: `matchMedia('(prefers-color-scheme: dark)')` change listener re-resolves while
   in system mode; `storage` event listener syncs the choice across tabs.
6. **Native UI**: `color-scheme` always tracks the resolved scheme (scrollbars, form controls); apps
   with a `theme-color` meta keep it in sync (iOS Safari navbar tint).
7. **UI semantics**: a real `<button>` cycling light -> dark -> system, an `aria-label` that names
   the mode it will switch to (the Nuxt UI convention), icon per mode (sun/moon/monitor) swapped by
   CSS from `data-theme-mode`, visible focus ring, comfortable hit target. Apps with richer chrome
   (revision.city) may use a segmented control instead; semantics stay equivalent.
8. **Tokens**: colors flow through semantic tokens with `base`/`_dark` values (Panda) or
   CSS-variable palettes (`:root` / `.dark` blocks, Tailwind) -- never raw per-component literals.
9. **Tests**: controller/bootstrap unit tests where a vitest harness exists; each app's e2e suite
   asserts (a) system dark is honored at first paint and (b) a persisted override beats the OS.

## Per-stack implementation

- **TanStack apps** (f311x, ravrun, forzamonica.com, startchi.com): hand-rolled `src/theme/` module
  -- `theme-bootstrap.ts`, `theme-controller.ts`, `theme-provider.tsx`, `theme-toggle.tsx` plus
  co-located tests. f311x is the canonical copy; the others are copies adapted to each app's styling
  system (apps keep independent dependency trees, so duplication is accepted until PR 2). Shipped
  through `ScriptOnce` (Start apps) or an inline `index.html` script (ravrun).
- **revision.city**: already the reference; gains the cross-tab `storage` listener it was missing.
  `@pierre/theming` stays -- the catalog features need it.
- **Astro apps** (djf.io, onvibes.org, calendar-visualizer): djf.io's toggle upgraded to the
  contract (tri-state, guarded storage, `color-scheme`, listeners, padded hit target) and its Panda
  condition moves from `[data-theme=dark]` to the default `.dark`; the upgraded component is copied
  to onvibes.org and calendar-visualizer. onvibes.org's chat.css hexes become `light-dark()` pairs.
- **davidjfelix.com**: was dark-only; David's call (2026-07-29 review): it gets a color mode too.
  The page's CSS variables become `light-dark()` pairs with `color-scheme: light dark` as the no-JS
  default (pure-CSS OS following), plus the shared Astro bootstrap + toggle on top.
- **SvelteKit apps** (alchemy-state-viewer, monicandavid.com): adopt `mode-watcher` with
  `modeStorageKey="theme"`; alchemy-state-viewer's tokens move `_osDark` -> `_dark`; a small shared
  toggle component per app. mode-watcher's `themeColors` prop is not used (verified bug: system mode
  picks the dark meta color on a light OS).
- **Nuxt** (pkg.dog): adopt `@nuxtjs/color-mode` with `storageKey: 'theme'`, `preference: 'system'`,
  `disableTransition: true`; add a client plugin with a `storage` listener for cross-tab parity;
  toggle component on the contract's semantics.

## Phases

### PR 1 -- parity (this PR)

- [x] Contract doc (this file) + comparison recorded
- [x] f311x: canonical `src/theme/` implementation, wired and tested
- [x] ravrun, startchi.com, forzamonica.com: adapted copies + minimal dark palettes where missing
- [x] revision.city: cross-tab storage listener
- [x] djf.io: tri-state upgrade; onvibes.org + calendar-visualizer: toggle + tokens
- [x] davidjfelix.com: `light-dark()` palette + bootstrap + toggle (added at David's request)
- [x] alchemy-state-viewer, monicandavid.com: mode-watcher adoption
- [x] pkg.dog: @nuxtjs/color-mode adoption
- [x] Changelog fragment

New dark palettes (forzamonica.com, startchi.com, monicandavid.com, pkg.dog, onvibes.org,
calendar-visualizer) are deliberately conservative first passes -- flagged for design review, not
final art.

### PR 2 -- extraction (next)

- Extract the TanStack/Astro hand-rolled core into a standalone package (bootstrap + controller +
  React adapter; Astro consumes the bootstrap + a vanilla binding). Candidate shape: a `workspaces/`
  package published or file-referenced per app.
- Svelte and Nuxt apps keep their ecosystem libraries, pinned to the contract by configuration; the
  package only replaces code we would otherwise hand-maintain in five places.
- Decide `@pierre/theming` interop for revision.city (persistence adapter already isolates it).

## Open questions for David

- Dark palette art direction for forzamonica.com (pastel pigment ramp on dark paper) and the
  small-site templates -- current values are conservative placeholders.
- ~~Should davidjfelix.com stay dark-only?~~ Answered 2026-07-29: no -- it has a color mode now.
- PR 2 packaging: `workspaces/` tree with per-app `file:` deps vs published npm package.
