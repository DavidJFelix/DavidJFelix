### feat(pkg.dog): decompose-and-serve feasibility spike answers yes (happy path)

The Phase 2 open question -- can a published package actually be decomposed into independently
installable parts? -- now has a working answer in `apps/pkg.dog/spike/`. The pipeline fetches a
package from JSR's npm-compat registry, builds the real module graph (runtime imports via
`Bun.Transpiler`, `.d.ts` imports via TypeScript's `preProcessFile`, since Bun erases type-only
imports), and plans parts: each non-barrel export subpath becomes a part owning its entry module
plus the internals only it reaches; imports of another part's entry are rewritten into real
exact-version package dependencies instead of bundled copies; mutually-cyclic entries merge;
internals reached by several parts split out as shared `__-internal-*` parts. Emitted parts carry
the upstream version, an exports map with types, and provenance under a `pkgdog` key.

pkg.dog is its own package manager (the JSR playbook), not a publisher onto npm: the consumer-facing
scheme is `pkgdog:@std/collections/chunk`, reversibly mangled to the npm-compat name
`@pkgdog/std__collections__chunk` and served from pkg.dog's registry so stock npm/bun/pnpm clients
work unchanged. The spike proves the serve half too: `src/registry-server.ts` packs every part into
an npm-layout tarball and speaks the npm protocol (packuments + tarballs), and
`bin/verify-registry.ts` runs a real `npm install` against it -- installing `aggregate-groups` alone
pulls `map-entries` in through the registry's own dependency metadata.

Run against `@std/collections@1.3.0`: 51 modules -> 50 parts, the root `mod.js` barrel correctly
skipped as a re-export aggregator, `aggregate-groups` / `reduce-groups` correctly depending on the
`map-entries` / `map-values` parts, every part's export names and types matching upstream, behavior
spot-checks passing through the rewritten cross-part dependency chain, and all 50 parts installing
through the spike registry with a stock npm client.

The spike carries 34 co-located bun tests -- planner edge cases (dependency boundaries, cyclic
merges, barrel detection), emitter output shape and specifier rewriting, and the registry server's
packuments, tarball integrity, and 404s -- wired into CI as a `spike-test` job. Writing them caught
a real bug: emit crashed on any module without a declaration file because the `_dist/` mirror guess
was read unchecked.

Also closed out Phase 1: the landing now explains the focusing lens concretely -- a three-step
fetch/decompose/serve strip and a proof line citing the 50-part decomposition -- with the Playwright
visual baseline regenerated.
