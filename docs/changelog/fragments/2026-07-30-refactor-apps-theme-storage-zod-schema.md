### refactor(apps): express the theme storage schema with zod 4

The theming contract's localStorage schema -- key `theme`, raw string values
`light`/`dark`/`system`, anything invalid or absent parsing to `system` -- was enforced by
hand-written validators duplicated across every module that reads the value. Those validators are
now one zod 4 schema, `z.catch(z.enum(['light', 'dark', 'system']), 'system')`, imported from
`zod/mini` so tree-shaking keeps the client-bundle cost to the schema actually used. It replaces
`isThemeMode` in the four TanStack theme controllers (f311x, ravrun, forzamonica.com, startchi.com),
the mode check in revision.city's persistence adapter, pkg.dog's `parseThemePreference`, and the
literal checks in the four Astro toggle scripts (djf.io, onvibes.org, calendar-visualizer,
davidjfelix.com); the `ThemeMode` types are now inferred from the schema instead of written
alongside it. Behavior is unchanged and the existing unit and e2e suites cover the swap.

Two deliberate exceptions: the pre-paint inline bootstrap scripts keep their self-contained literal
check (they cannot import anything before first paint) and each is commented as the schema's
compiled twin, and the SvelteKit apps carry no zod because mode-watcher validates internally with
the same semantics. The planned theming package (PR 2 in
`docs/projects/theme-switcher-unification/plan.md`) will export this schema once as the single
source of truth.
