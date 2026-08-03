import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  strictTokens: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{js,ts,svelte}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {
      // Semantic palette for the shared theme-switcher contract
      // (docs/projects/theme-switcher-unification/plan.md). `_dark` is Panda's
      // built-in `.dark &` condition, which mode-watcher's darkClassNames
      // applies to <html>. A conservative first pass -- flagged for design
      // review, not final art. `text.subtle` covers the page's second muted
      // step (neutral.500, distinct from the neutral.600 used for `text.muted`)
      // and mirrors around neutral.500, which is its own dark-mode match.
      semanticTokens: {
        colors: {
          bg: {
            canvas: {value: {base: '{colors.white}', _dark: '{colors.neutral.950}'}},
          },
          text: {
            DEFAULT: {value: {base: '{colors.neutral.900}', _dark: '{colors.neutral.100}'}},
            muted: {value: {base: '{colors.neutral.600}', _dark: '{colors.neutral.400}'}},
            subtle: {value: {base: '{colors.neutral.500}', _dark: '{colors.neutral.500}'}},
          },
          border: {value: {base: '{colors.neutral.200}', _dark: '{colors.neutral.800}'}},
        },
      },
    },
  },
})
