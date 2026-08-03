### fix(djf.io): keep the pagefind loader out of the bundler so search survives inlining

Search was dead on every page of djf.io -- the dialog opened, typing did nothing, and not even the
"no results" state appeared. The built HTML carried `__VITE_PRELOAD__` verbatim in 20 files, so the
pagefind import threw a `ReferenceError` before it could resolve. It reproduces on `060367e` with a
clean install, so it had been shipping.

`import(/* @vite-ignore */ url)` is still wrapped in Vite's preload helper, and that helper leaves a
`__VITE_PRELOAD__` placeholder which Vite only substitutes in chunks it emits. Astro guards against
precisely this in `shouldInlineScriptChunk` -- it refuses to inline a chunk with dynamic imports --
but the guard reads `output.dynamicImports`, which never lists a vite-ignored import. The chunk
therefore looked import-free, came in under the 4096-byte inline limit, and was folded into every
page's HTML with the placeholder intact. The loader now goes through
`new Function('specifier', 'return import(specifier)')`, which hides the import from static analysis
entirely: the chunk is genuinely import-free, so inlining it is correct, and search works whether it
ends up inlined or external. The site sends no CSP; this would need `unsafe-eval` if one is added.

This is the second time this broke and the first diagnosis was wrong. 2026-07 blamed rolldown
`1.1.5` and pinned back to `1.1.4`, but the failure now reproduces on `1.1.4` too, so no rolldown
version was ever the trigger -- the pin was treating a symptom. With the loader fixed the pin is
free to move on its own merits, and rolldown goes to `1.2.1`: alchemy `beta.67` depends on `1.1.5`
by exact version and nuxt `4.5.1` wants `^1.2.0`, so `1.1.4` satisfied neither and pkg.dog's nuxt
was running outside its peer range.

Worth knowing for the next person: playwright's `reuseExistingServer` is enabled whenever `CI` is
unset, so a local run can attach to a server still serving an earlier build and report a pass that
means nothing. Every result here is from a clean `dist` under `CI=1` -- djf.io's Search suite 7/7
and its full suite 49/49 (2 skipped) on both `1.1.4` and `1.2.1`, with zero `__VITE_PRELOAD__` in
`dist/`.
