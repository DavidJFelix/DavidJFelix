# lint-format-loose-ends

Residual of the closed `linter-formatter-standardization` project (see the 2026-06-18 changelog).
The JS/TS standard is set and documented; this holds the concrete cleanups left over, with the
scope decisions already made.

## Scope

### 1. Format all of `docs/` + guard it (decided: format everything)

- Run Prettier (`proseWrap: always`) across all of `docs/` — a one-time reflow of 40+ files,
  including notes authored with semantic line breaks. Expect large diffs; this is intentional.
- Add a `prettier --check` guard so `docs/` Markdown can't drift again. Extend `ci-repo.yml`
  (it already triggers on `docs/**`) with a check step, or add a small dedicated job.
- This removes the current papercut where adding a changelog entry reflows the whole file.

### 2. `.config/cspell.json` → `.config/cspell.jsonc`

- Rename to JSONC and add a comment explaining the ATProto-DID `ignoreRegExpList` entry (added
  during djf.io's standard.site work; unexplained in plain JSON).
- Fix every by-name reference: the three root tasks in `.config/mise.toml`
  (`format`, `format:fix`, `spell`), `docs/contributing/configuration-style.md`,
  `docs/contributing/tooling-standard.md`, and `docs/contributing/github-actions-style.md`. Both
  cspell and Biome accept `.jsonc`; leave historical changelog/progress references as-is.
- **Sequence after `ci-pipeline-efficiency` Task 1**, which removes `.config/cspell.json` from the
  per-app `ci-*.yml` path filters entirely — so this rename no longer has to touch ~12 workflows.

### 3. Fold the legacy JS dirs into the standard — low priority

- `Joy-of-React/` (two projects with Biome configs extending root but no CI) and
  `Advent-of-Code/2020/*/typescript` (eight projects with no lint/format config) sit outside the
  standard. Wire them in (configs + CI) when convenient. Explicitly low priority.

## Decided, no work

- **Rust is scoped out.** No clippy/rustfmt/CI for the exercise crates until a real Rust project
  exists. Revisit then.

## Related

- Closed parent + resolved decisions: `docs/changelog/2026-06.md` (2026-06-18)
- `docs/contributing/tooling-standard.md` — the ownership map this completes
- `ci-pipeline-efficiency` — sequence the cspell rename after its filter cleanup
