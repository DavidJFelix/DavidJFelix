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

### 2. `.config/cspell.json` → `.config/cspell.jsonc`

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

### 4. Fold the legacy JS dirs into the standard — low priority

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
