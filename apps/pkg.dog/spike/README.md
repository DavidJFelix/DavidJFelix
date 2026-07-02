# pkg.dog decompose spike

Phase 2 feasibility spike for the pkg.dog focusing-lens pipeline: fetch a published JSR package,
decompose it into independently publishable parts, and verify each part against upstream. See
[docs/projects/pkg-dog/plan.md](../../../docs/projects/pkg-dog/plan.md) for the project plan.

## Result (2026-07-02)

Feasible for the happy path. `@std/collections@1.3.0` (51 modules) decomposes into **50 parts** that
all pass verification:

- The root `mod.js` barrel is detected as a re-export aggregator and skipped -- the barrel is the
  thing being decomposed.
- `aggregate-groups` and `reduce-groups` import other exported utilities; those imports become real
  package dependencies (`@pkgdog/std-collections--map-entries`, `--map-values`) with the import
  specifiers rewritten in the emitted files, instead of bundled copies.
- Every part's export names and types match upstream, and behavior spot-checks pass through the
  rewritten cross-part dependency chain.
- All 50 parts pass `npm publish --dry-run`.

## How it decomposes

1. **Fetch** the package from JSR's npm-compat registry (`npm.jsr.io`) and extract the tarball.
2. **Graph**: scan runtime imports with `Bun.Transpiler` and `.d.ts` imports with TypeScript's
   `preProcessFile` (Bun erases type-only imports, so both scanners are needed); pair each `.js`
   with its declaration file via the exports map.
3. **Plan** (`src/decompose.ts`): each non-barrel export subpath becomes a part owning its entry
   module plus the internals only it reaches. Imports of another part's entry become package
   dependencies; mutually-cyclic entries merge into one part; internals reached by several parts
   move to shared `--internal-*` parts.
4. **Emit**: write each part as an installable package -- files keep their package-relative paths,
   cross-part import specifiers are rewritten, and `package.json` carries the exports map, exact-
   version part dependencies, and upstream provenance under a `pkgdog` key.
5. **Verify**: copy all parts into a throwaway consumer's `node_modules` and, in a child process,
   import every published specifier, comparing export names and types against the upstream module.

## Usage

```sh
bun install
mise run decompose            # default: @std/collections (latest)
bun bin/decompose.ts @std/collections 1.3.0
mise run publish-parts        # npm publish --dry-run for every emitted part
PKGDOG_PUBLISH=1 mise run publish-parts   # real publish (needs @pkgdog npm auth)
```

`work/` holds the extracted upstream and the verify consumer; `out/` holds the emitted parts and
`decompose-plan.json`. Both are gitignored build output.

## Known limits (deliberate spike cuts)

- Source maps are not carried (their `sources` point at `.ts` files the parts do not ship).
- Type-level verification is behavioral only (export names/types); no `tsc` resolution check yet.
- Parts reuse the upstream version verbatim; a real pipeline needs its own version epoch so a
  re-decomposition of the same upstream version can ship fixes.
- Specifier rewriting is a quoted-string replacement of scanned specifiers, not an AST transform.
- Barrel detection (re-export-only module with two or more internal imports) and the aggregator skip
  rule are heuristics tuned for stdlib-shaped packages.
