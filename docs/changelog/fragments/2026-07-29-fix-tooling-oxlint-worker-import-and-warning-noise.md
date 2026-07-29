### fix(tooling): unblock revision.city's lint gate and cut oxlint's warning noise

The oxlint 1.70 to 1.76 bump in the last lock-file maintenance pass landed with
`CI revision.city / oxlint + biome` already red, and it was the only failing lint check in the
monorepo. Since oxlint 1.73 the import resolver follows `@pierre/diffs/worker/worker.js?worker` past
Vite's `?worker` suffix to the untransformed module, which exports nothing, so `import/namespace`
reports a missing default export that exists only after Vite's worker transform. The code was always
correct -- `tsc` resolves the import through `vite/client`'s `declare module '*?worker'`, and the
build, unit tests, and smoke gate never stopped passing -- so the import carries a one-line
`oxlint-disable-next-line` naming the rule and what actually enforces the contract. Bisected to
1.73.0: 1.72.0 and earlier exit clean on the same tree.

Two rules that were reporting nothing useful are now off centrally. `react/react-in-jsx-scope` fires
in every React app despite all of them compiling with the automatic JSX runtime, which injects the
factory; oxlint's `settings.react` has no `runtime` key to detect that the way eslint-plugin-react's
jsx-runtime config does. `unicorn/no-negated-condition` duplicates the eslint core rule the pedantic
category already enables -- both fire on the same 26 locations repo-wide, neither adding coverage
the other misses. Together they were more than half of every oxlint finding in the monorepo: 1535
across the twelve apps drops to 670, with revision.city going 595 to 222, forzamonica.com 328 to 83,
f311x 158 to 50, and ravrun 146 to 67. No signal is lost -- both rules were unactionable everywhere
they fired.

Both offs are documented in the linting guide alongside the existing central exceptions, together
with when a single-line `oxlint-disable-next-line` is legitimate and when to pin the tool back
instead.

### fix(tooling): retrigger app CI when mise tool versions change

The per-app CI workflows path-filtered on `.config/mise.toml` but not `.config/mise.lock`, which is
the file that actually pins tool versions -- a bump that touched only the lockfile could land
without a single app's checks running. The oxlint regression above slipped in during a pass that
happened to touch app lockfiles too, so CI did run and did go red; a pure tool bump would have been
invisible. All fifteen CI workflows now watch both files.
