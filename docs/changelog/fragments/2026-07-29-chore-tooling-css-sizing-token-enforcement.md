### chore(tooling): gate raw CSS sizing values behind design tokens

Raw length values -- `13px`, `1.5rem`, `2em`, and friends -- could previously slip into any style
object unnoticed. Both styling systems now put a gate in front of them, without adding any new tool
to the stack: the Panda side is enforced by TypeScript, the Tailwind side by oxlint. Biome
deliberately gained no new responsibilities, per the oxc-only direction.

All nine Panda apps now set `strictTokens: true` in `panda.config.ts`. Token-bound properties
(spacing, sizes, fonts, colors, radii, and the rest) only accept theme tokens, `var(--x)`
references, or Panda's explicit `[...]` escape hatch -- a raw `'13px'` is a type error the moment
`panda codegen` runs. Every pre-existing raw value -- 401 across the nine apps, most of them in
revision.city (192) and forzamonica.com (91) -- was wrapped in an escape hatch in the same change,
chosen over token substitution deliberately: `'600'` became `'[600]'`, not `'semibold'`, so the
emitted CSS is byte-identical and nothing shifts visually. The brackets are the point -- they turn
what used to be invisible drift into a greppable burn-down list (`rg "'\[" apps/<app>/src`), tracked
as scope item 4 of the `lint-format-loose-ends` project. All nine apps typecheck clean.

A same-day exact-match pass then burned down 82 of the 401 brackets: values whose app token
dictionary already held a byte-identical entry became real tokens (`'[600]'` to `'semibold'`,
`'[1.25rem]'` on `fontSize` to `'xl'`, `'[100dvh]'` to the preset's `dvh` literal, and so on). The
319 that remain were each verified to have no exact flat-token equivalent -- px values whose nearest
tokens are rem-denominated (different behavior under user font scaling), off-scale values, and
multi-part composites -- so each needs a design decision rather than a mechanical swap.

The two Tailwind v4 apps (f311x, ravrun) get `oxlint-tailwindcss` wired through oxlint's `jsPlugins`
in a new per-app `.oxlintrc.jsonc` extending the root config, with `tailwindcss/no-arbitrary-value`
at `warn`: class-string equivalents of the same sin (`max-w-[80%]`, `min-w-[56rem]`) now surface in
the existing lint gate. Four findings exist today, listed in the project plan; the rule is promoted
to `error` once they are fixed. The daily-ui workspace trees keep their Tailwind-v0-era configs and
stay outside the standard, as before.

Rejected on the way here: running `@pandacss/eslint-plugin` under oxlint's JS-plugin engine. It
works -- verified end to end -- but it bundles `panda.config.ts` with esbuild at lint time, and
oxlint's plugin host reserves so much virtual address space (~28 GB) that the spawn fails with
ENOMEM under default Linux overcommit on modest hosts. The type-level gate covers the same ground
with zero lint-time cost.
