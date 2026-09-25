### fix(tooling): hold the Astro apps at TypeScript 6 now that astro check refuses 7

Lock file maintenance moved astro from 7.3.3 to 7.3.5, and `typecheck` failed in
calendar-visualizer, davidjfelix.com, and djf.io with "astro check does not currently support
TypeScript 7.0". Since 2026-08 those apps ran `typescript` 7 while `astro check` walked up to an
`@astrojs/check` and a `typescript` 6.0.3 declared at the web-apps workspace root --
`@astrojs/check` peers with the TypeScript beside its own instance, so the root copy did the
checking. astro 7.3.4 closed that seam
([withastro/astro#18053](https://github.com/withastro/astro/pull/18053)): the command now resolves
`typescript` from the app directory before it looks for `@astrojs/check`, and bails when that is 7,
whatever the checker would have peered with. The message points at `@astrojs/ts-content-mapper` as
the way forward, but that needs TypeScript 7.1, which is not published yet.

So the arrangement is unwound the way its note said it would be, just for a different reason: the
three Astro apps pin `typescript` 6.0.3 and declare `@astrojs/check` themselves, exactly as the
Svelte and Nuxt apps hold `svelte-check` and `vue-tsc` on 6, and the workspace root drops its
devDependencies. Renovate's sub-7 hold covers the Astro apps again instead of the root manifest. The
lockfile diff is that move alone: the three nested `typescript@7.0.2` entries go, and no resolution
changes elsewhere.

The same run also bumped every workspace Biome config's `$schema` from 2.5.10 to 2.5.14, the pinned
CLI version, which silences the "configuration schema version does not match" notice each `lint`
task printed.
