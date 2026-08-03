### chore(tooling): move the rolldown pin off 1.1.4 now the chunk-metadata regression is fixed

rolldown has been held at `1.1.4` since 2026-07 because `1.1.5` dropped vite-ignored external
dynamic imports from chunk `dynamicImports` metadata: Astro's script inliner then judged djf.io's
pagefind loader inline-safe and folded it into every page's HTML before Vite substituted the
`__VITE_PRELOAD__` marker, so every page threw a `ReferenceError` and search went dead. The
workspace override now moves to `1.2.1`, which fixes it.

The hold-back had started to cost something. alchemy `2.0.0-beta.67` depends on rolldown `1.1.5` by
exact version and nuxt `4.5.1` wants `^1.2.0`, so `1.1.4` satisfied neither -- the override was
quietly forcing both off their declared versions, and pkg.dog's nuxt was running against a rolldown
outside its peer range. `1.2.1` clears nuxt's range and moves alchemy forward rather than back. The
pin stays rather than being dropped, because dropping it lets djf.io float to whatever vite resolves
-- which is the exact drift that produced the original regression -- and because one converged
rolldown is what has actually been tested. `1.2.2` exists but published within the 24-hour
`minimumReleaseAge` cooldown, so it is not resolvable yet.

Verified against the suite that caught the original break: djf.io's `Search.e2e.test.ts` passes 7/7
both before and after, its full e2e suite passes 49/49 (2 skipped), and the mechanism is confirmed
directly rather than inferred -- the built `dist/` contains no `__VITE_PRELOAD__` anywhere and the
search script is still emitted as an external module script instead of being inlined. pkg.dog builds
green on the new rolldown, and the alchemy CLI still loads f311x's stack through to the Cloudflare
credentials step.
