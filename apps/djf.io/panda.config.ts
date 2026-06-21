import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx,js,jsx,astro}', './pages/**/*.{ts,tsx,js,jsx,astro}'],
  exclude: [],
  theme: {
    extend: {
      tokens: {
        fonts: {
          body: {value: "'Inter Variable', system-ui, sans-serif"},
          heading: {value: "'Schibsted Grotesk Variable', 'Inter Variable', system-ui, sans-serif"},
          mono: {value: "'JetBrains Mono Variable', ui-monospace, monospace"},
        },
      },
    },
  },
  globalCss: {
    'html, body': {fontFamily: 'body'},
    'h1, h2, h3, h4, h5, h6': {fontFamily: 'heading'},
    'code, kbd, samp, pre': {fontFamily: 'mono'},
  },
  jsxFramework: 'react',
  outdir: 'styled-system',
})
