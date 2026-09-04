### fix(djf.io): make the dev server usable under the workerd runtime

`astro dev` runs requests inside the Cloudflare adapter's workerd runner, and four things broke
there. Vite discovered several SSR deps lazily on the first request, and the resulting mid-run
re-optimization deleted chunk hashes the runner was still requesting, crashing the dev process; they
are now predeclared in `ssr.optimizeDeps.include` so optimization finishes at startup. Sharp cannot
load inside workerd, so every `astro:assets` image 404ed at `/_image`; dev now uses the
`passthrough` image service (unresized but visible) while builds keep sharp. Search had no index in
dev, so the Pagefind integration now serves the last build's `dist/client/pagefind` at
`/pagefind/*`. And `run_worker_first` routed Vite's dev-only URL prefixes (`/@fs`, `/@id`, `/@vite`,
`/src`, `/node_modules`, and the absolute source path) into the worker, where they 404ed and no
client JS ran; those prefixes are now negated. Alongside this, the `prose` recipe gained a
`maxW: 'prose'` base style and uses Panda's `jsx` array, and a few redundant `as unknown as` casts
were dropped from tests.
