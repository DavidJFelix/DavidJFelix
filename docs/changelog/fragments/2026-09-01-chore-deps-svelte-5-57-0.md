### chore(deps): update svelte to 5.57.0 and run typecheck after build

Renovate's svelte bump failed CI on `alchemy-state-viewer#build` with
`"default" is not exported by .svelte-kit/generated/shared/error-template.js`. The code was fine:
turbo ran the package's `typecheck` and `build` tasks side by side, `svelte-kit sync` (typecheck)
and `vite build` both rewrite `.svelte-kit/generated`, and SvelteKit writes those files with a plain
`writeFileSync`, so build read the error template mid-rewrite. The same overlap exists for
`astro check` against `astro build` and for `tsc` against vite's `routeTree.gen.ts` rewrite, so
`typecheck` now depends on `build` in `turbo.json` for every package instead of a per-app patch.

The Renovate branch had also regenerated `bun.lock` with bun 1.3.11, downgrading the lockfile format
and the root `packageManager` pin and pulling in unrelated transitive churn. Restored the lock from
main and re-applied the bump with the pinned bun 1.4.0; the resulting diff is the svelte bump plus
two entries (`oxlint-tailwindcss`, `lucide-react`) that main's lock had drifted from the
package.json pins.
