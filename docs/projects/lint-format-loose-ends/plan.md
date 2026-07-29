# lint-format-loose-ends

Residual of the closed `linter-formatter-standardization` project (see the 2026-06-18 changelog).
The JS/TS standard is set and documented; this holds the concrete cleanups left over, with the scope
decisions already made.

## Scope

### 1. Format all of `docs/` + guard it — DONE 2026-07-02

- Reflowed 42 files (`docs/**` + root `*.md`) with `prettier --write`; the check is the root
  `format:md` mise task (bare `prettier --check .`) gated by the new `ci-docs.yml`.
- Scope refinements while wiring: `apps/` excluded from the root sweep (per-app gates own app
  markdown, and a root run would not honor djf.io's `src/content/` semantic-line-break exclusion);
  `.agents/` excluded because `skills-lock.json` pins skill content hashes; `.claude/` (symlinks)
  and the legacy dirs excluded to mirror the spell gate.
- `.prettierrc.json` also gained the JS/TS house-style options (`semi: false`, `singleQuote: true`,
  `bracketSpacing: false`) so code fences embedded in docs format to the same style Biome enforces
  in real source.

### 2. `.config/cspell.json` → `.config/cspell.jsonc` (done 2026-07-22)

Landed with the cspell dictionary audit rather than waiting on `ci-pipeline-efficiency` Task 1 --
the ~12 per-app workflow path filters were updated by hand in the same PR. Original scope:

- Rename to JSONC and add a comment explaining the ATProto-DID `ignoreRegExpList` entry (added
  during djf.io's standard.site work; unexplained in plain JSON).
- Fix every by-name reference: the three root tasks in `.config/mise.toml` (`format`, `format:fix`,
  `spell`), `docs/contributing/configuration-style.md`, `docs/contributing/tooling-standard.md`, and
  `docs/contributing/github-actions-style.md`. Both cspell and Biome accept `.jsonc`; leave
  historical changelog/progress references as-is.
- **Sequence after `ci-pipeline-efficiency` Task 1**, which removes `.config/cspell.json` from the
  per-app `ci-*.yml` path filters entirely — so this rename no longer has to touch ~12 workflows.

### 3. Enforce code-style.md mechanically (added 2026-07-02)

The code style guide (`docs/contributing/code-style.md`) landed 2026-07; this item tracks wiring its
lintable rules into the existing per-app oxlint gate via the root `.oxlintrc.json`.

**Done (2026-07-02)** — rules verified zero-violation across all apps + `bin/`, enabled at `error`:

- `max-params` (max 3) — the named-arguments rule's mechanical floor
- `typescript/consistent-type-imports` — `import type` for type-only imports
- `vitest/no-hooks` + `vitest/max-nested-describe` (max 0) — testing.md's no-hooks / no-describe
  rules; enabling the `vitest` plugin also surfaced 13 real `correctness` findings
  (`require-mock-type-parameters` in every app's `sentry-tunnel.test.ts` copy,
  `no-conditional-expect` in djf.io), fixed in the same change

**Remaining:**

- `typescript/consistent-type-definitions` (interface over type) is on at `warn` — ~45 findings:
  forzamonica.com 12, djf.io 9, f311x 7, and 2 each in the other eight apps (mostly the shared
  `sentry-tunnel.ts` copy). Fix them, then promote the rule to `error`.
- Oxlint `warn` findings don't gate (plain `oxlint` exits 0 on warnings), so the pedantic/perf
  categories are advisory today. Decide whether that's intended or whether specific always-fix rules
  should be promoted to `error` one by one (blanket `--deny-warnings` would gate hundreds of
  pedantic findings at once — too blunt).
- The rules that can't be linted (classes must earn their place, pipelines over loops, params-object
  naming semantics) stay with the review personas — `engineering-reviewer` owns them.

### 4. CSS sizing token enforcement — burn down, then promote (added 2026-07-29)

Raw length values (px/em/rem/ex and friends) are now gated in both styling systems; this item tracks
converting the grandfathered values to real tokens and tightening the gates.

- **Panda apps** (all nine): `strictTokens: true` is on in every `panda.config.ts`, so token-bound
  properties only accept tokens, `var(--x)`, or the explicit `[...]` escape hatch. Existing raw
  values were mechanically wrapped in escape hatches to keep rendered output identical — they are
  the burn-down list, greppable per app with `rg "'\[" apps/<app>/src`. Fix by choosing a real token
  (or adding one to the app's theme), not by deleting the brackets.
- **Burn-down status (2026-07-29, exact-match pass)**: 82 of the 401 wrapped values matched an
  existing token or sanctioned utility literal byte-for-byte and were converted
  (alchemy-state-viewer 41, revision.city 27, calendar-visualizer 4, forzamonica.com 4, djf.io 2,
  plus `[100dvh]` → `dvh` in the four single-hatch apps). 319 remain (revision.city 165,
  forzamonica.com 87, alchemy-state-viewer 48, djf.io 15, calendar-visualizer 4) — every one
  verified to have no exact flat-token equivalent. What's left needs a design decision per value:
  extend the app theme with a token, move the value onto the scale, or accept the bracket. Unit
  conversions (`8px` vs `0.5rem` tokens) and semantic tokens (which add dark-mode behavior) were
  deliberately not substituted.
- Two flags from the pass, undecided: revision.city's `fill: '[currentcolor]'` (x3) differs from the
  `colors.current` token value `currentColor` only in casing — normalize or keep; and
  revision.city's `fontSize: '[base]'` (`src/routes/index.tsx`, `src/routes/diffs/index.tsx`) is a
  pre-existing latent bug — `font-size: base` is not valid CSS and browsers ignore the declaration,
  so fixing it to a real token (probably `md`) would visibly change rendering and needs its own
  decision.
- **Tailwind apps** (f311x, ravrun): `oxlint-tailwindcss` is wired via `jsPlugins` in each app's
  `.oxlintrc.json` with `tailwindcss/no-arbitrary-value` at `warn`. Current findings:
  - f311x `src/routes/index.tsx:70` — `max-w-[80%]` (twice)
  - ravrun `src/routes/index.tsx:448` — `grid-cols-[auto_repeat(7,minmax(0,1fr))]`, `min-w-[56rem]`
  - Fix each by extending the theme in `src/styles.css` (`@theme { ... }`) or restructuring, then
    **promote the rule to `error`**.
- The daily-ui workspace trees keep their Tailwind-v0-era configs and stay out of scope, same as
  item 5.
- Native oxlint cannot see any of this (no CSS parsing, no `no-restricted-syntax`); the Tailwind
  rules ride the alpha `jsPlugins` engine, and the Panda gate is TypeScript-level via codegen, so
  neither depends on Biome.

### 5. Fold the legacy JS dirs into the standard — low priority

- `workspaces/joy-of-react/` (two projects with Biome configs extending root but no CI) and
  `workspaces/advent-of-code/2020/*/typescript` (eight projects with no lint/format config) sit
  outside the standard. Wire them in (configs + CI) when convenient. Explicitly low priority.

## Decided, no work

- **Rust is scoped out.** No clippy/rustfmt/CI for the exercise crates until a real Rust project
  exists. Revisit then. Sizing data (measured 2026-07-02):
  `cargo clippy --workspace -W clippy::pedantic` reports ~48 findings across the Advent of Code 2022
  crates, dominated by `uninlined_format_args`, `redundant_closure_for_method_calls`, and
  `print_with_newline` — a single modest fix-up PR when the time comes. The wiring is
  `[workspace.lints]` in the root `Cargo.toml` plus `[lints] workspace = true` per crate, per
  [code-style.md](../../contributing/code-style.md#rust).

## Related

- Closed parent + resolved decisions: `docs/changelog/2026-06.md` (2026-06-18)
- `docs/contributing/tooling-standard.md` — the ownership map this completes
- `ci-pipeline-efficiency` — sequence the cspell rename after its filter cleanup
