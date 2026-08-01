# Bun Migration

Move the apps from pnpm to bun as package manager and script runner. This plan starts from a
hands-on feasibility spike (2026-08-01, bun 1.3.11): every app was copied to a scratch tree,
installed with `bun install`, built, and unit-tested; one app also ran its full Playwright e2e
suite. Everything passed. What remains is mechanical -- lockfiles, trust lists, and rewriting `pnpm`
invocations -- plus one real decision about the tooling standard.

## Scope

Package manager and script runner only. Node stays the toolchain runtime: vitest, Playwright,
wrangler, the astro/vite/nuxt CLIs, and svelte-check all keep running on the mise-pinned node, and
production runtime is workerd either way. `bun test` does not replace vitest (see "Not in scope").
Repo-root `bin/` scripts already run on bun.

## Feasibility evidence (2026-08-01, bun 1.3.11)

All 12 apps pass `bun install`, `bun run build`, and `bun run test` (vitest with the coverage gates)
in scratch copies, covering every framework family:

- Astro: calendar-visualizer, davidjfelix.com, djf.io (sharp, satori, pagefind), onvibes.org
  (including the flue worker build and its existing `bun bin/patch-flue-wrangler.ts` step)
- TanStack Start: f311x (alchemy/effect beta tree), forzamonica.com, revision.city, startchi.com
- SvelteKit: alchemy-state-viewer, monicandavid.com (svelte-check clean too)
- Nuxt 4: pkg.dog
- Vite SPA: ravrun

Additional probes, all clean: Playwright e2e on davidjfelix.com (8 passed including the visual
baseline, with `wrangler dev` booting workerd from the bun-installed tree), and
`bun x wrangler deploy --dry-run`.

## What bun does for free

- **Migrates `pnpm-lock.yaml` in place.** `bun install` with no `bun.lock` imports the pnpm lockfile
  instead of re-resolving: djf.io got rolldown 1.1.4 (the pinned override) and davidjfelix.com kept
  `@sentry/astro` 10.68.0 while 10.69.0 was available. Migration bumps nothing.
- **Carries pnpm `overrides` into `bun.lock`** -- djf.io's rolldown pin, f311x's supply-chain pins,
  and onvibes.org's MCP SDK dedupe pin all survived.
- **Runs `prepare` on install** -- panda codegen and `svelte-kit sync` fire exactly as under pnpm.
- **`--frozen-lockfile` works pre-migration**: with only `pnpm-lock.yaml` present it migrates and
  verifies, so CI ordering is not a constraint during the transition.
- **A release-age cooldown exists**: `[install] minimumReleaseAge` in `bunfig.toml` is enforced
  (probe: a 1-year setting resolved zod 4.0.14 instead of 4.4.3). It replaces pnpm 11's default 24h
  cooldown, with two catches: bun's default is off, and `bunfig.toml` is not inherited from parent
  directories (verified), so every app needs its own file or the protection silently lapses.
- **Default-trusted postinstalls** cover esbuild, sharp, and workerd -- the native heavy hitters --
  while core-js stays blocked, matching today's `allowBuilds` intent.

## Mechanical work inventory

Per app (x12):

1. `bun install` (migrates the lockfile), commit `bun.lock`, delete `pnpm-lock.yaml`.
2. Move `pnpm-workspace.yaml` `overrides` into package.json `"overrides"`, then delete
   `pnpm-workspace.yaml` (three apps carry overrides: djf.io, f311x, onvibes.org).
3. Port `allowBuilds` to `"trustedDependencies"`. Caveat proved in the spike: declaring
   `trustedDependencies` replaces bun's default trust list -- listing only `@sentry/cli` blocked
   esbuild's and workerd's postinstalls on the next fresh install. Both still worked (their binaries
   ship as platform optionalDependencies; build and e2e passed with the scripts blocked), but the
   port should enumerate the full per-app allow list (`esbuild`, `workerd`, `sharp` where built,
   `@sentry/cli` where present, f311x's `msgpackr-extract`/`msw`) so behavior stays explicit,
   matching pnpm's allowBuilds semantics. `allowBuilds: false` entries need no port -- unlisted
   means blocked. `@sentry/cli` must be trusted wherever sourcemap upload runs at deploy build time;
   `bun pm trust @sentry/cli` verified the binary downloads.
4. Add `bunfig.toml` with `[install]` `minimumReleaseAge = 86400`.
5. mise.toml tasks: `pnpm run X` becomes `bun run X` (~8 lines per app).
6. package.json scripts that embed pnpm: the `deploy` scripts (`pnpm run build && wrangler deploy`),
   djf.io's `test`, onvibes.org's `build`.

Repo-wide:

7. CI: 88 `pnpm install --frozen-lockfile` steps across 27 `.depot/workflows` files become
   `bun install --frozen-lockfile`; `pnpm exec` steps (panda codegen x9, vite build x6, astro build
   x4, nuxt build, playwright, alchemy) become `bun x` or `bun run`.
8. `.claude/hooks/session-start.ts`: the pnpm install loop becomes bun install (or detects the
   per-app lockfile during the transition).
9. `bin/deploy-preview-worker.ts`, `bin/upload-preview.ts`, and `bin/install-playwright-deps.ts`
   invoke pnpm.
10. `.config/mise.toml`: drop `pnpm = "11"` once the last app moves.
11. Docs sweep: tooling-standard.md is the decision gate (currently "pnpm (or bun where no Node
    toolchain is needed)"); CONTRIBUTING.md and the contributing guides mention pnpm throughout.
12. Renovate: `renovate.json` has no pnpm-specific config and Renovate supports `bun.lock`; verify
    on the pilot app's first Renovate PR (overlaps the renovate-rollout project).

Playwright configs need nothing -- webServer commands already spawn `node_modules/.bin/*` directly.

## Not in scope (measured, rejected for now)

- **`bun test` replacing vitest.** Pure-logic files run unmodified (`bun test` remaps vitest
  imports; ravrun's plan-engine suite passed as-is), but three gaps block the repo's suites:
  `vi.stubGlobal` and `vi.resetModules` are absent from bun's compat shim (used by the theme suites
  in five apps and revision.city), there is no jsdom environment (bun wants a happy-dom preload; the
  vitest configs declare jsdom), and bun's coverage has no branch metric while every app gates on
  branches >= 90. Revisit per-app if bun's vitest compat closes those gaps.
- **bun as the toolchain runtime.** `bun --bun run build` did build the Astro pilot, but nothing is
  gained -- CI time is dominated by framework builds, not node startup -- and wrangler, vitest, and
  Playwright are exercised upstream on node daily. Not worth the compatibility surface.

## Risks

- **Hoisted layout**: bun installs npm-style hoisted `node_modules`; pnpm's strict symlinks are
  gone, so phantom imports (undeclared dependencies) stop failing fast. Everything passes today; the
  risk is future regressions land silently.
- **Cooldown is opt-in**: pnpm 11 gave the release-age cooldown by default; a forgotten
  `bunfig.toml` reopens the day-of supply-chain window. The pilot makes the file part of the pattern
  every later app copies.
- **Lockfile churn at migration is zero** (proved), but the first real `bun update` behaves like any
  update -- the usual Renovate discipline applies.

## Phases

1. **Decision** -- amend tooling-standard.md to make bun the package manager for apps, or park this
   project. Nothing below proceeds without this.
2. **Pilot** -- davidjfelix.com end to end in one PR: lockfile swap, `trustedDependencies`,
   `bunfig.toml`, mise.toml, scripts, and its three workflows (ci, cd-preview, cd-deploy), with the
   session-start hook made lockfile-aware. Watch a full preview + deploy cycle and the first
   Renovate PR before going wider.
3. **Rollout** -- the remaining 11 apps, one PR per app (steps 1-6 above are identical each time);
   each app's workflows move with it.
4. **Retire pnpm** -- session-start hook simplification, the three `bin/` scripts, the
   `.config/mise.toml` pin, and the docs sweep.
