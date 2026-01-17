import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx,js,jsx,astro}', './pages/**/*.{ts,tsx,js,jsx,astro}'],
  exclude: [],
  theme: {
    extend: {},
  },
  jsxFramework: 'react',
  outdir: 'styled-system',
})
