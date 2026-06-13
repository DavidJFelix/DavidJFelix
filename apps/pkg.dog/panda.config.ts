import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./app/**/*.{vue,ts}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {},
  },
})
