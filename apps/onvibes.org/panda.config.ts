import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx,astro}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {},
  },
})
