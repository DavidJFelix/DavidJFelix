import {defineConfig} from '@pandacss/dev'

// Each semantic role resolves light -> dark through Panda's built-in `_dark`
// condition (`.dark &`), driven by the class the no-flash theme bootstrap sets
// on <html> before paint -- see src/pages/index.astro and
// docs/projects/theme-switcher-unification/plan.md. Conservative first pass:
// flagged for design review, not final art. Dark counterparts keep the hue and
// flip lightness (see the per-pair report in the theme-switcher-unification
// PR for the full rationale on each choice).
const lightDark = (base: string, dark: string) => ({value: {base, _dark: dark}})

export default defineConfig({
  // Whether to use css reset
  preflight: true,
  strictTokens: true,

  // Where to look for your css declarations
  include: ['./src/**/*.{js,jsx,ts,tsx,astro}', './pages/**/*.{js,jsx,ts,tsx,astro}'],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          // Base roles the calendar island (src/components/calendar.tsx) uses
          // outside the highlighted-day variants.
          canvas: lightDark('{colors.stone.50}', '{colors.stone.900}'),
          day: lightDark('{colors.white}', '{colors.stone.950}'),
          text: lightDark('{colors.stone.700}', '{colors.stone.300}'),
          border: lightDark('{colors.stone.300}', '{colors.stone.700}'),
          heading: lightDark('{colors.red.700}', '{colors.red.400}'),
          title: lightDark('{colors.stone.950}', '{colors.stone.50}'),
          // One role per highlighted-day family: bg/border/text for each.
          holiday: {
            bg: lightDark('{colors.red.100}', '{colors.red.950}'),
            border: lightDark('{colors.red.500}', '{colors.red.400}'),
            text: lightDark('{colors.red.950}', '{colors.red.200}'),
          },
          weekend: {
            bg: lightDark('{colors.stone.200}', '{colors.stone.800}'),
            text: lightDark('{colors.stone.950}', '{colors.stone.200}'),
          },
          planning: {
            bg: lightDark('{colors.blue.100}', '{colors.blue.950}'),
            border: lightDark('{colors.blue.500}', '{colors.blue.400}'),
            text: lightDark('{colors.blue.950}', '{colors.blue.200}'),
          },
          execution: {
            bg: lightDark('{colors.green.100}', '{colors.green.950}'),
            border: lightDark('{colors.green.500}', '{colors.green.400}'),
            text: lightDark('{colors.green.950}', '{colors.green.200}'),
          },
          hipsSprint: {
            bg: lightDark('{colors.purple.100}', '{colors.purple.950}'),
            border: lightDark('{colors.purple.500}', '{colors.purple.400}'),
            text: lightDark('{colors.purple.950}', '{colors.purple.200}'),
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: 'styled-system',
})
