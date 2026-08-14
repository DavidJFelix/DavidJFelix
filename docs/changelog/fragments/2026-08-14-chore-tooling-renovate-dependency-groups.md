### chore(tooling): group tanstack ai, vite plugins, and effect in renovate

Three new Renovate package rules group related dependencies into single PRs across every update
type, following the wrangler + cloudflare vite plugin precedent. The `@tanstack/ai` packages (core
plus framework bindings and adapters) release as a matched set, so they now move together. `vite`
and its plugins (`@vitejs/**`, `@tailwindcss/vite`, `@sveltejs/vite-plugin-*`,
`@tanstack/devtools-vite`) bump as one group so plugin updates land against the matching vite
version -- `@cloudflare/vite-plugin` stays out, paired with wrangler in its existing rule. `effect`
and the `@effect` scope version against a shared core, so they now converge in a single PR too.
