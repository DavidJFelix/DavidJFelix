# Testing

## Test style

- **Co-locate tests** with the file under test. Unit: `xxx.test.ts` next to `xxx.ts`. E2E:
  `xxx.e2e.test.ts` next to the source.
- **No `describe` blocks**. Flatten tests to top-level -- see
  https://kentcdodds.com/blog/avoid-nesting-when-youre-testing. Do not add `describe` even for
  "grouping". If a test needs context, put it in the test name. Enforced by oxlint
  `vitest/max-nested-describe` (max 0) and `vitest/no-hooks` in the root `.oxlintrc.json`.
- **Avoid `beforeEach`/`beforeAll`/`afterEach`/`afterAll`** unless a framework requires it. Prefer
  top-level setup (top-level `await` for async), inline setup inside each test, or a small named
  helper called from each test. Hooks hide control flow and make tests harder to read.
- **Parameterize instead of copy-pasting.** When several tests differ only in inputs and expected
  outputs, use a top-level `test.each` (vitest and `bun:test` both support it) over a case table.
  The table rows carry the case names -- this replaces `describe` grouping, it doesn't excuse it.
- **Given/when/then bodies, minimal setup.** Each test reads as: the givens (a few `const`s), the
  action, the assertions -- in that order, no nesting, nothing the test doesn't use. If setup needs
  more than a few lines, extract a named helper and call it from the test.
- **Property-based and fuzz where the input space warrants it.** A parser, codec, or invariant
  (`decode(encode(x)) === x`) deserves generated inputs, not three hand-picked ones:
  [fast-check](https://fast-check.dev/) in TypeScript, `proptest` / `cargo-fuzz` in Rust. Keep
  example-based tests alongside for the known edge cases.
- **For tests inside `src/pages/` (Astro routing constraint)**: prefix with `_` (e.g.
  `_index.e2e.test.ts`). Astro treats every `.ts` in `src/pages/` as an endpoint; the underscore is
  its built-in escape hatch. Outside `src/pages/`, no prefix.

## Runtime checks: smoke and e2e

Build-time checks (typecheck, lint, unit, build) can't catch an app that builds green but is broken
at runtime (f311x shipped that way on 2026-06-11). Every **deployed** app gets a canonical runtime
gate -- a `smoke` mise task, or a Playwright e2e suite that subsumes it (`apps/djf.io`):

- **Contract**: `mise run smoke` (declares `depends = ["build"]`) boots the app's _production build_
  locally and asserts the critical path serves -- each key route returns 200 as a complete document
  whose hashed client assets also serve; an app with a backend also exercises it (f311x POSTs the
  chat endpoint and requires the echo stream). Deterministic and secret-free, so it runs on every
  PR.
- **Boot per stack** (reference scripts live in each app's `bin/smoke-local.ts`, bun): static Astro
  -> `astro preview`; Vite SPA -> `vite preview`; Cloudflare Worker / SSR -> `wrangler dev` on the
  built worker (workerd), because `*-preview` only serves static assets. Spawn the preview **binary
  directly** (`node_modules/.bin/...`), not via `pnpm run` -- killing the pnpm wrapper doesn't
  cascade to the server, so it outlives teardown and holds the port.
- **Knobs**: `SMOKE_*` env vars (URLs / routes / port) keep the same checks pointable at a local
  boot now and a per-PR preview deploy later.
- **CI**: a `smoke` job per deployed app, mirroring the `vitest` job.
- **e2e** (Playwright, `*.e2e.test.ts`) is the heavier browser-based layer for hydration /
  interaction / visual regression; optional per app, and a superset of smoke (see `apps/djf.io`).

## Coverage and the monorepo aggregator

- Apps with real unit-testable logic gate it with **vitest v8 coverage scoped to the logic** -- not
  UI / route / worker glue, which smoke + e2e cover. Set `coverage.include` to the tested modules
  (e.g. `src/lib/**`) and `coverage.thresholds` as a ratchet at / just under current, and run the
  unit task with `--coverage` so CI enforces it. f311x and djf.io are wired (100% on their logic);
  calendar-visualizer and forzamonica.com follow the same recipe. (Under Astro's `getViteConfig` the
  per-file `text` table renders empty -- cosmetic; `text-summary` and threshold enforcement work.)
- **`mise run test` / `mise run check` at the repo root** fan the task out to every app
  (`bin/run-app-tasks.ts`), for a one-command "verify the whole monorepo" -- complementing the
  per-app, path-filtered CI. They run each app with `CI=true` so pnpm's no-TTY deps-purge check
  can't abort.
