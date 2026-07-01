# Linting

Fix findings, don't silence them. Don't disable a lint rule or exclude files to make a finding
disappear -- fix the actual issue. Two shortcuts are specifically banned:

- **Per-app Biome overrides that turn rules off.** Biome lints only the `---` frontmatter of an
  `.astro` file, not the template, so a symbol used only in markup (`<Calendar />`, `{title}`)
  reads as unused. That single false positive is handled **once**, centrally, in the root
  `biome.jsonc` (`noUnusedImports` / `noUnusedVariables` off for `**/*.astro`); `astro check`
  (tsgo) is template-aware and owns unused-symbol detection for Astro. Do not re-add a per-app
  `*.astro` override.
- **Excluding files to dodge a real finding.** e.g. don't add `!**/*.svg` to skip
  `noSvgWithoutTitle` -- give the SVG a `<title>` or `role="img"` + `aria-label` instead (see any
  `apps/*/public/favicon.svg`).

Which linter owns which file type is defined in [tooling-standard.md](tooling-standard.md).
