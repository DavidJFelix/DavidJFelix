### chore(tooling): upgrade to TypeScript 7 and retire tsgo

TypeScript 7 ships the native (Go) compiler as the `typescript` package itself, so the
`@typescript/native-preview` (tsgo) preview dependency is retired everywhere. The five tsc-checked
apps (f311x, forzamonica.com, ravrun, revision.city, startchi.com) now pin `typescript` 7.0.2 and
run `tsc --noEmit`; the two Astro apps that only carried tsgo for the editor tsdk (davidjfelix.com,
djf.io) drop the dependency outright, matching the other Astro apps where `astro check` resolves its
own TypeScript peer. The advent-of-code 2020 TypeScript workspaces move to 7.0.2 too, which forced
two fixes: TS 7 removed `target: es5` (now `es2015`), and automatic `@types` discovery never worked
in those trees, so `types: ["node"]` is set explicitly -- they type-check clean for the first time.

The Svelte and Nuxt apps (alchemy-state-viewer, monicandavid.com, pkg.dog) stay on TypeScript 6:
`svelte-check` and `vue-tsc` embed the TypeScript JS compiler API, which the native compiler no
longer ships -- `svelte-check` crashes outright on 7 (`useCaseSensitiveFileNames` on undefined),
which is what broke Renovate's typescript-7 PR (#338). Those apps are held at `<7` by a Renovate
package rule until the framework checkers support TS 7, expected around 7.1; alchemy-state-viewer
catches up from 5.9.3 to 6.0.3 in the meantime. CI job names, mise task descriptions, editor tsdk
paths, and the tooling standard doc follow the rename.
