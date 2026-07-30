import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  strictTokens: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./app/**/*.{vue,ts}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {
      // Repo-wide theme contract (docs/projects/theme-switcher-unification/plan.md):
      // colors flow through semantic tokens with base/_dark pairs, never raw
      // per-component literals. _dark matches Panda's built-in condition for the
      // `.dark` class @nuxtjs/color-mode applies to <html>. Scoped to the grays
      // app/app.vue actually uses -- neutral.500 (secondary/eyebrow/footer text)
      // consolidates into text.muted alongside neutral.600 rather than adding a
      // fifth token for a shade this small a landing page doesn't need split out.
      semanticTokens: {
        colors: {
          bg: {
            canvas: {value: {base: '{colors.white}', _dark: '{colors.neutral.950}'}},
          },
          text: {
            DEFAULT: {value: {base: '{colors.neutral.900}', _dark: '{colors.neutral.100}'}},
            muted: {value: {base: '{colors.neutral.600}', _dark: '{colors.neutral.400}'}},
          },
          border: {
            value: {base: '{colors.neutral.200}', _dark: '{colors.neutral.800}'},
          },
        },
      },
    },
  },
})
