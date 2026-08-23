### chore(tooling): refresh lockfiles and satisfy oxlint 1.79's react correctness rules

Renovate's lock file maintenance refreshed every lockfile -- the web-apps bun workspace, the mise
toolchain, the cargo and pnpm exercise trees -- and the mise refresh pulled in oxlint 1.79, which
ships four new error-level react correctness rules: `set-state-in-effect`, `refs`, `globals`, and
`static-components`. Those rules flagged real render-phase side effects across three packages, all
fixed in code rather than by loosening the linter. The setState-on-mount hydration gates in the
shared theme package, revision.city's theme provider, and its review UI became
`useSyncExternalStore` gates; the latest-value ref mirrors in the patch loader, theme cycle, and
file tree were deleted outright, their readers becoming stable callbacks or `useEffectEvent` events
that see live values; prop-driven state resets in the diffs sidebar, diff url form, and worker pool
status adopted the render-time adjustment pattern, while the status panel's reload-on-return flag
moved into its visibility listener's closure; forzamonica.com's cart keys the gift note field by
server truth and derives the quantity display from a draft that remembers which server quantity it
was based on; the theme dropdown builds its trigger icon as an element instead of a render-created
component type; and the hook test probes render their state as JSON so tests read committed output
instead of reassigning outer bindings during render.
