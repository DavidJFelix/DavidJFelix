import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
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
            canvas: {value: {base: '{colors.white}', _dark: '{colors.neutral.950}'}},
          },
          text: {
            DEFAULT: {value: {base: '{colors.neutral.900}', _dark: '{colors.neutral.100}'}},
            muted: {value: {base: '{colors.neutral.600}', _dark: '{colors.neutral.400}'}},
          },
          border: {
            DEFAULT: {value: {base: '{colors.neutral.200}', _dark: '{colors.neutral.800}'}},
          },
        },
      },
    },
  },
})
