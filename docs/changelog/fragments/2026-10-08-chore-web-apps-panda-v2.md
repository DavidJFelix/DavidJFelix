### chore(web-apps): upgrade Panda CSS to v2

`@pandacss/dev` moves from 1.12.1 to 2.1.1 in the workspace catalog, the release that replaces
Panda's TypeScript extractor with a Rust engine. The styling API is unchanged, so no source edits
were needed in any of the nine Panda apps: their `css()` calls, patterns, recipes, and `styled` JSX
props compile as before, and the PostCSS plugin and `panda codegen` keep working from the existing
configs.

Three breaking changes reached this repo:

- v1 bundled `@pandacss/preset-base` and `@pandacss/preset-panda` inside `@pandacss/dev` and applied
  both by default; v2 ships them as standalone packages and applies only the presets a config lists.
  Every Panda app now declares both packages (pinned in the catalog at the same version as
  `@pandacss/dev`, as the upgrade guide requires for every `@pandacss/*` package) and lists both in
  `presets`, including the two apps that previously relied on the implicit default and had lost
  every preset token and condition.
- v2 writes the generated runtime as `index.js` where v1 wrote `index.mjs`. The two SvelteKit apps
  (alchemy-state-viewer and monicandavid.com) reach the output through a `#styled-system/*` subpath
  import in package.json that named the old extension, so their builds could not resolve any
  styled-system module until the import map was pointed at `index.js`. Local checkouts should run
  `panda codegen --clean` once, since v2 does not delete the stale v1 files.
- v2 loads the app's tsconfig to follow path aliases, and pkg.dog's tsconfig references files that
  `nuxt prepare` generates, so its `prepare` script now runs `nuxt prepare` before `panda codegen`.

v2 also narrows the `prose` size token in `@pandacss/preset-panda` from `65ch` to `60ch`, which
djf.io's prose recipe and the forzamonica.com root layout use for their measure.
