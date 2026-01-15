import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],

  include: ['./src/**/*.{ts,tsx,js,jsx,astro}', './pages/**/*.{ts,tsx,js,jsx,astro}'],
  exclude: [],

  // Custom theme with semantic tokens
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          // Foreground (text) colors
          fg: {
            default: {
              value: {base: '{colors.neutral.900}', _dark: '{colors.neutral.100}'},
            },
            muted: {
              value: {base: '{colors.neutral.600}', _dark: '{colors.neutral.400}'},
            },
            subtle: {
              value: {base: '{colors.neutral.500}', _dark: '{colors.neutral.500}'},
            },
          },
          // Background colors
          bg: {
            canvas: {
              value: {base: '{colors.white}', _dark: '{colors.neutral.950}'},
            },
            muted: {
              value: {base: '{colors.neutral.100}', _dark: '{colors.neutral.800}'},
            },
            emphasized: {
              value: {base: '{colors.neutral.200}', _dark: '{colors.neutral.700}'},
            },
          },
          // Border colors
          border: {
            default: {
              value: {base: '{colors.neutral.200}', _dark: '{colors.neutral.800}'},
            },
          },
        },
      },
    },
  },

  // Enable dark mode via class or system preference
  conditions: {
    dark: '[data-theme="dark"] &, .dark &, @media (prefers-color-scheme: dark)',
  },

  jsxFramework: 'react',
  outdir: 'styled-system',
})
