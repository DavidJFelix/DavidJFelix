### chore(web-apps): move the SvelteKit apps to SvelteKit 3 and adapter-cloudflare 8

SvelteKit 3 no longer reads `svelte.config.js`, so `bun install` failed in the `prepare` script of
monicandavid.com and alchemy-state-viewer. Both apps now pass the adapter and preprocessor to the
`sveltekit(...)` plugin in `vite.config.ts`. SvelteKit 3 also removed `$lib`, deprecated `alias`,
and moved the generated tsconfig and environment modules, so the apps now:

- resolve `#lib/*` and `#styled-system/*` through package.json subpath imports (Panda reads the
  `#styled-system` import map), with explicit `.ts` extensions on `#lib` imports because TypeScript
  resolves subpath imports to exact files; the vitest aliases are gone
- extend `$app/tsconfig` instead of `.svelte-kit/tsconfig.json`
- declare their server variables in `src/env.ts` with `defineEnvVars` and read them from
  `$app/env/private` instead of `$env/dynamic/private`
- import the `Handle` type from `@sveltejs/kit/hooks`
