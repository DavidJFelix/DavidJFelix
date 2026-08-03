import {defineConfig} from '@pandacss/dev'

// Each semantic role resolves light -> dark through Panda's built-in `_dark`
// condition (`.dark &`), driven by the class the no-flash theme bootstrap sets
// on <html> before paint -- see src/layouts/BaseLayout.astro and
// docs/projects/theme-switcher-unification/plan.md. Conservative first pass:
// flagged for design review, not final art.
const lightDark = (base: string, dark: string) => ({value: {base, _dark: dark}})

export default defineConfig({
  preflight: true,
  strictTokens: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx,astro}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: {
            canvas: lightDark('{colors.white}', '{colors.neutral.950}'),
          },
          text: {
            DEFAULT: lightDark('{colors.neutral.900}', '{colors.neutral.100}'),
            muted: lightDark('{colors.neutral.600}', '{colors.neutral.400}'),
          },
          border: lightDark('{colors.neutral.200}', '{colors.neutral.800}'),
        },
      },
    },
  },
})
