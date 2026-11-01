### fix(alchemy-state-viewer): hold @ark-ui/svelte at 5.24.3

The lock file maintenance run moved `@ark-ui/svelte` from 5.24.3 to 5.25.0, and the
alchemy-state-viewer build and typecheck failed. The 5.25.0 package keeps the `$lib/...` imports of
its source in the published `dist` instead of relative paths. SvelteKit 3 removed `$lib`, so
`vite build` stopped with `module_removed_lib`. svelte-check also lost the prop types, so `children`
was not a known prop of `JsonTreeView.Root`. The two apps that depend on the package
(alchemy-state-viewer and monicandavid.com) now pin it to exactly 5.24.3. A Renovate rule holds it
below 5.25.0 until a release uses relative imports again.
