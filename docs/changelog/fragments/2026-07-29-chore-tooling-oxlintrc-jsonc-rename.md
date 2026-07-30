### chore(tooling): rename .oxlintrc.json to .oxlintrc.jsonc

The oxlint configs (repo root, f311x, ravrun) were already JSONC in content -- oxlint parses its
config through a JSONC parser regardless of extension, and the root file has carried comments since
the lint migration -- so the extension now says what the file is, per the configuration-style rule
preferring JSONC over JSON. Verified before renaming: oxlint 1.76 auto-discovers `.oxlintrc.jsonc`
both in the linted directory and via ancestor walk-up (diagnostic counts identical to the `.json`
baseline in djf.io, f311x, and ravrun), and `extends` follows the new paths.

References updated in the same change: the 14 Depot CI workflow path filters, the root mise
`format`/`format:fix` file lists, the biome.jsonc comment, the contributing guides, and the active
lint-format-loose-ends project docs. Historical changelog and progress mentions keep the old name,
same as the cspell rename before it. One trade acknowledged: SchemaStore's editor auto-association
only matches `**/.oxlintrc.json`, so the inline `$schema` line -- which points at the same URL
SchemaStore serves -- is now load-bearing rather than redundant.
