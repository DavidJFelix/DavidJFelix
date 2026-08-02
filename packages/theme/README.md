# @davidjfelix/theme

The repo theming contract (see
[docs/projects/theme-switcher-unification/plan.md](../../docs/projects/theme-switcher-unification/plan.md))
as a package: tri-state light/dark/system color schemes with pre-paint bootstrap, live OS tracking,
and cross-tab sync. Consumed by apps as a `file:` dependency; each app keeps its own lockfile and
imports raw TypeScript source (no build step -- every consumer bundles with Vite).

| Subpath       | Contents                                                            |
| ------------- | ------------------------------------------------------------------- |
| `.`           | `createThemeController` -- the single owner of theming state        |
| `./schema`    | The zod storage schema, mode vocabulary, and toggle cycle order     |
| `./bootstrap` | The pre-paint bootstrap function and its inline-script generator    |
| `./react`     | `ThemeProvider` + `useTheme` (React 19 peer)                        |
| `./toggle`    | `bindThemeToggle`, the vanilla DOM binding for framework-free pages |

Markup, styling, and toggle chrome stay with each app; this package owns only the behavior. Every
consumer generates its pre-paint inline script from `./bootstrap` at build time -- ScriptOnce for
the TanStack apps (ravrun's SPA-mode shell is prerendered, so its ScriptOnce ships in static HTML),
`is:inline set:html` for Astro -- so there are no hand-synced copies anywhere. The SvelteKit and
Nuxt apps use mode-watcher and @nuxtjs/color-mode configured to the same contract and do not consume
this package.
