### fix(f311x): move alchemy to beta.79 and effect to rc.116 together

Renovate's alchemy bump (beta.77 to beta.79) and its effect bump (rc.112 to rc.116) each failed
alone. Alchemy beta.78 was rebuilt against effect rc.115, whose `Config` constructors are PascalCase
(`Config.String`), and raised its peer range to match, while the workspace still pinned effect
rc.112 in f311x and in the root overrides that keep a single effect copy in the tree. The preview
deploy died loading alchemy's own `Auth/Profile.ts` with `Config.String is not a function`; the
effect PR died the mirror-image way, because alchemy beta.77 and f311x's github stack still called
`Config.string`. This lands both bumps in one change, moves the two override pins, and renames the
one call in `github.ts`.

The renovate config now folds `effect` and `@effect/**` into the "alchemy packages" group so the
next release-candidate bump on either side arrives as one PR instead of two that block each other.
