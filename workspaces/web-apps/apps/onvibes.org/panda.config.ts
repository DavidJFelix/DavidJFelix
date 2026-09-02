import {defineConfig} from '@pandacss/dev'

// Each semantic role resolves light -> dark through Panda's built-in `_dark`
// condition (`.dark &`), driven by the class the no-flash theme bootstrap sets
// on <html> before paint -- see src/routes/__root.tsx. Conservative first pass:
// flagged for design review, not final art.
const lightDark = (base: string, dark: string) => ({value: {base, _dark: dark}})

export default defineConfig({
  preflight: true,
  strictTokens: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: {
            canvas: lightDark('{colors.white}', '{colors.neutral.950}'),
            // The sidebar and other secondary panes: one step off the canvas.
            surface: lightDark('{colors.neutral.50}', '{colors.neutral.900}'),
            // Hover and selected rows inside a surface.
            hover: lightDark('{colors.neutral.100}', '{colors.neutral.800}'),
            selected: lightDark('{colors.neutral.200}', '{colors.neutral.800}'),
            // Scrim behind the small-screen sidebar drawer.
            backdrop: lightDark('rgb(10 10 10 / 0.4)', 'rgb(0 0 0 / 0.6)'),
          },
          text: {
            DEFAULT: lightDark('{colors.neutral.900}', '{colors.neutral.100}'),
            muted: lightDark('{colors.neutral.600}', '{colors.neutral.400}'),
          },
          border: lightDark('{colors.neutral.200}', '{colors.neutral.800}'),
          // The user's own messages invert the canvas so the two voices read
          // apart without a second hue.
          inverse: {
            bg: lightDark('{colors.neutral.900}', '{colors.neutral.100}'),
            text: lightDark('{colors.white}', '{colors.neutral.950}'),
          },
          focus: {
            ring: {value: '{colors.sky.500}'},
          },
        },
      },
    },
  },
})
