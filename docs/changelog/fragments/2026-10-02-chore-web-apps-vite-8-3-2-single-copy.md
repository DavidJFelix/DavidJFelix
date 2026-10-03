### chore(web-apps): move the vite catalog pin to 8.3.2 so astro shares one vite copy

Lock file maintenance resolved the `vite@^8.0.13` range of astro 7.3.5 to a nested vite 8.3.2, while
the catalog pinned vite 8.2.2 at the workspace root. `getViteConfig` from astro then took the
`UserConfig` type of the nested copy, but `vitest/config` adds the `test` field to the root copy, so
`astro check` failed with ts(2353) on `vitest.config.ts` in davidjfelix.com and calendar-visualizer.
An override back to 8.2.2 cannot work, because `@astrojs/react` 7 requires `vite@^8.3.0`. The
catalog now pins 8.3.2, and all of the nested vite copies are gone.
