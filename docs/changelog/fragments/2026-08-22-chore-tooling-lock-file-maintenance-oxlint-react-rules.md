### chore(tooling): refresh lockfiles and satisfy oxlint 1.79's react correctness rules

Renovate's lock file maintenance refreshed every lockfile -- the web-apps bun workspace, the mise
toolchain, the cargo and pnpm exercise trees -- and the mise refresh pulled in oxlint 1.79, which
ships four new error-level react correctness rules: `set-state-in-effect`, `refs`, `globals`, and
`static-components`. Those rules flagged real render-phase side effects across three packages, all
fixed in code rather than by loosening the linter. The setState-on-mount hydration gates in the
shared theme package, revision.city's theme provider, and its review UI became
`useSyncExternalStore` gates; latest-value ref mirrors in the patch loader, theme cycle, and file
tree moved into dependency-less effects; prop-driven state resets in the diffs sidebar, status
panel, diff url form, and forzamonica.com's cart adopted the render-time adjustment pattern; the
worker pool status derives its stats during render; the theme dropdown builds its trigger icon as an
element instead of a render-created component type; and the hook test probes capture state in
effects instead of reassigning outer bindings during render.
