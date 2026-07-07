### feat(tooling): migrate linting and formatting from Biome to oxlint + oxfmt

Oxlint is now the primary linter and oxfmt the primary formatter; Biome remains only where oxc does
not reach. The old setup ran Biome's full recommended preset (248 rules active across this repo's
JS/TS/JSX, CSS, and framework files) with oxlint as a supplement. Every one of those rules was
fixtured and tested against both engines: 175 are now enforced by oxlint (the root `.oxlintrc.json`
gained the vue and oxc plugins, ~30 explicit rule enables, and ~11 severity alignments), and 46 stay
with Biome -- all 25 CSS rules plus one HTML rule (oxlint parses neither language), 18 JS-family
rules with no usable oxlint equivalent, and 2 whose oxlint ports are type-aware-only. The evidence
is checked in as the lint-parity kit (`.config/lint-parity/`, `mise run lint:parity`, gated by
`ci-repo.yml`): one violating fixture per rule, each asserted against the engine that now owns it.

oxfmt (pinned via mise, config in `.oxfmtrc.json`) formats JS/TS/JSX/TSX, JSON/JSONC, CSS, and Vue
byte-identically to Biome's output -- verified across five apps' full source trees -- so the switch
produced no reformat churn. Biome's formatter is scoped down to `.astro` frontmatter and `.svelte`
script blocks, which oxfmt cannot parse yet, and Biome assist still organizes imports. Prettier
keeps md/mdx. App `format`/`format:fix`/`lint:fix` scripts, the root format task, per-app CI paths,
and editor settings were rewired accordingly; the four inline `biome-ignore` suppressions in app
code became `oxlint-disable-next-line` with the same rationales.
