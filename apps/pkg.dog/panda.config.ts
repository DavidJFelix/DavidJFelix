import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,vue}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {},
  },
})
