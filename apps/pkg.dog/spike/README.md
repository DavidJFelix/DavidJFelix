# pkg.dog decompose spike

Phase 2 feasibility spike for the pkg.dog focusing-lens pipeline: fetch a published JSR package,
decompose it into independent parts, and serve those parts from pkg.dog's own registry over the npm
protocol. See [docs/projects/pkg-dog/plan.md](../../../docs/projects/pkg-dog/plan.md) for the
project plan.

pkg.dog is its own package manager, not a publisher onto npm (the JSR playbook): consumers write
`pkgdog:@scope/package` -- potentially down to a single module, `pkgdog:@std/collections/chunk` --
and the specifier maps to a reversibly mangled npm-compat name (`@pkgdog/std__collections__chunk`)
served from pkg.dog's registry endpoint, so stock npm/bun/pnpm clients work unchanged.

## Result (2026-07-02)

Feasible for the happy path, through the full loop -- decompose AND serve:

- `@std/collections@1.3.0` (51 modules) decomposes into **50 parts**. The root `mod.js` barrel is
  detected as a re-export aggregator and skipped -- the barrel is the thing being decomposed.
- `aggregate-groups` and `reduce-groups` import other exported utilities; those imports become real
  exact-version dependencies on the `map-entries` / `map-values` parts, with the import specifiers
  rewritten in the emitted files, instead of bundled copies.
- Every part's export names and types match upstream, and behavior spot-checks pass through the
  rewritten cross-part dependency chain.
- The spike registry serves all 50 parts over the npm protocol (packuments + tarballs), and a stock
  `npm install` against it works -- including the cross-part dependency arriving via the registry's
  own metadata, not because the consumer asked for it.

## How it works

1. **Fetch** the package from JSR's npm-compat registry (`npm.jsr.io`) and extract the tarball.
2. **Graph**: scan runtime imports with `Bun.Transpiler` and `.d.ts` imports with TypeScript's
   `preProcessFile` (Bun erases type-only imports, so both scanners are needed); pair each `.js`
   with its declaration file via the exports map.
3. **Plan** (`src/decompose.ts`): each non-barrel export subpath becomes a part owning its entry
   module plus the internals only it reaches. Imports of another part's entry become package
   dependencies; mutually-cyclic entries merge into one part; internals reached by several parts
   move to shared `__-internal-*` parts. Part names use JSR-style reversible mangling
   (`pkgdog:@std/collections/chunk` <-> `@pkgdog/std__collections__chunk`).
4. **Emit**: write each part as an installable package -- files keep their package-relative paths,
   cross-part import specifiers are rewritten, and `package.json` carries the exports map, exact-
   version part dependencies, and upstream provenance under a `pkgdog` key.
5. **Verify** (`src/verify.ts`): copy all parts into a throwaway consumer's `node_modules` and, in a
   child process, import every published specifier, comparing export names and types against the
   upstream module.
6. **Serve** (`src/registry-server.ts`): pack each part into an npm-layout tarball and serve
   packuments + tarballs from a local HTTP server speaking the npm protocol;
   `bin/verify-registry.ts` proves a real `npm install` resolves parts and their cross-part
   dependencies through it. The production shape is this exact protocol on the pkg.dog Worker.

## Usage

```sh
bun install
mise run decompose            # default: @std/collections (latest)
bun bin/decompose.ts @std/collections 1.3.0
mise run verify-registry      # serve out/ over the npm protocol, npm-install through it
```

`work/` holds the extracted upstream, the verify consumers, and the registry staging; `out/` holds
the emitted parts and `decompose-plan.json`. All gitignored build output.

## Known limits (deliberate spike cuts)

- The registry is in-memory and local; production needs the same protocol on the Worker with R2/KV
  storage, plus a `pkgdog:` resolver (a thin CLI like `jsr add` that writes the scope mapping and
  npm-compat names into the consumer's manifest).
- Source maps are not carried (their `sources` point at `.ts` files the parts do not ship).
- Type-level verification is behavioral only (export names/types); no `tsc` resolution check yet.
- Parts reuse the upstream version verbatim; the real registry needs its own version epoch so a
  re-decomposition of the same upstream version can ship fixes.
- Specifier rewriting is a quoted-string replacement of scanned specifiers, not an AST transform.
- Barrel detection (re-export-only module with two or more internal imports) and the mangling's `__`
  separator (ambiguous if an upstream name itself contains `__`) are heuristics tuned for
  stdlib-shaped packages. Same for part naming: subpaths in different directories can slug to the
  same name, and a real subpath could collide with a `__-internal-*` name; the real registry needs
  collision detection before publishing.
