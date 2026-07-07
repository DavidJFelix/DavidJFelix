# Lint parity kit

Proof that the Biome -> oxlint/oxfmt migration kept every previously-active lint rule enforced. Run
it with `mise run lint:parity` (CI: the `lint-parity` job in `ci-repo.yml`).

## What it contains

- `fixtures/<group>/<rule>.<ext>` -- one file per rule that was active under the old root Biome
  config (the 2.5 recommended preset plus the react/test/vue domains this repo's apps activate).
  Each file violates exactly that rule; most bodies come from Biome's own rule documentation.
- `manifest.json` -- for every fixture, the engine that must catch it now:
  - `"engine": "oxlint"` entries expect an oxlint diagnostic code (e.g. `eslint(no-var)`,
    `oxc-syntax-error` for constructs oxc's parser rejects outright) using the root
    `.oxlintrc.json`.
  - `"engine": "biome"` entries expect a Biome diagnostic category (e.g.
    `lint/correctness/noUnknownUnit`) using the pruned root `biome.jsonc`.

`bin/lint-parity.ts` runs both tools over the fixtures and fails if any expectation stops firing --
rerun it whenever `.oxlintrc.json`, `biome.jsonc`, or a tool version changes.

## Rules deliberately not in the manifest

- **8 GraphQL rules** (`noDuplicateFields`, `useDeprecatedReason`, ...): the repo has no
  `.graphql`/`.gql` files, so they cannot fire anywhere. Revisit if GraphQL documents land.
- **16 Vue template-directive rules** (`useVueValidVIf`, `useVueVForKey`, ...): inert in Biome
  2.5.0, which does not lint `.vue` templates (only `.html` files, and no repo `.html` contains Vue
  directives). oxlint cannot see Vue templates either, so neither the old nor the new setup checked
  them.
- **3 Biome-config hygiene rules** (`noBiomeFirstException`, `noQuickfixBiome`,
  `useBiomeIgnoreFolder`): they lint Biome's own config files and editor settings, which the root
  `mise run format` task covers via `biome lint`; a fixture would require a decoy `biome.json`
  inside this tree, which Biome would pick up as a real nested config.

## Known equivalence caveats

A few oxlint rules are close-but-not-identical ports; the fixture proves the core defect is caught,
and the delta is accepted:

- `noCommaOperator` -> `eslint/no-sequences` exempts parenthesized sequences.
- `noExportsInTest` -> stays in Biome: oxlint's port lives in the jest plugin, and enabling that
  plugin double-reports every jest/vitest twin rule.
- `useGoogleFontDisplay` -> stays in Biome: oxlint's port lives in the nextjs plugin, whose other
  correctness rules false-positive on non-Next apps.
- `useExportType` / `useOptionalChain` -> stay in Biome: the oxlint ports are type-aware-only
  (require the experimental `--type-aware` mode).
- `noGlobalIsNan` / `noGlobalIsFinite` -> `unicorn/prefer-number-properties` also rewrites global
  `parseInt`/`parseFloat`/`NaN`/`Infinity` (currently zero findings repo-wide).
