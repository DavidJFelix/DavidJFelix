import {defineConfig} from '@pandacss/dev'
import {createPreset} from '@park-ui/panda-preset'
import neutral from '@park-ui/panda-preset/colors/neutral'
import slate from '@park-ui/panda-preset/colors/slate'

export default defineConfig({
  preflight: true,
  presets: [
    '@pandacss/preset-base',
    createPreset({
      accentColor: neutral,
      grayColor: slate,
      radius: 'md',
    }),
  ],
  include: ['./src/**/*.{ts,tsx,js,jsx,astro}', './pages/**/*.{ts,tsx,js,jsx,astro}'],
  exclude: [],
  theme: {
    extend: {},
  },
  jsxFramework: 'react',
  outdir: 'styled-system',
})
