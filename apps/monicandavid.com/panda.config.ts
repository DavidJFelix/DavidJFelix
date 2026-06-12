import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{js,ts,svelte}'],
  exclude: [],
  outdir: 'styled-system',
  theme: {
    extend: {},
  },
})
