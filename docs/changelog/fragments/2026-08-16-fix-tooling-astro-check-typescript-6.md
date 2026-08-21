### fix(tooling): keep the Astro apps on TypeScript 7 by giving astro check the workspace root's 6

The `typescript` 7 bump broke `typecheck` in all four Astro apps -- `astro check` is built on the JS
compiler API (`ts.sys`, `ts.findConfigFile`, Volar's `LanguageServiceHost`) that the native compiler
does not ship, so it fails at startup with "The TypeScript module loaded (found 7.0.2) does not
expose the programmatic API that `astro check` relies on". Rather than hold the apps at 6.x, the two
versions now coexist with no new code: `@astrojs/check` resolves its `typescript` peer beside its
own instance (`createRequire(import.meta.url).resolve('typescript')`), so wherever it is declared
decides which compiler checks the `.astro` files.

It is now declared exactly once, at the web-apps workspace root, next to a `typescript` 6.0.3
devDependency -- bun peers that root instance with the 6. calendar-visualizer, davidjfelix.com,
djf.io, and onvibes.org drop their direct `@astrojs/check`, keep `typescript` 7.0.2, and their
unchanged `astro check` script finds the root's copy by normal node resolution walk-up. Nothing else
in the workspace can reach the 6.x. Renovate's sub-7 hold moves off the Astro apps and onto the
workspace root manifest; the Svelte and Nuxt apps stay pinned, since `svelte-check` and `vue-tsc`
resolve TypeScript from the project and offer no equivalent seam. The whole arrangement is deleted
-- root devDeps back to the app manifests -- once the Astro language server runs on the native
compiler ([withastro/roadmap#1321](https://github.com/withastro/roadmap/discussions/1321)).
