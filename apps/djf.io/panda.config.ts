import {defineConfig} from '@pandacss/dev'
import {
  grass,
  grassA,
  grassDark,
  grassDarkA,
  olive,
  oliveA,
  oliveDark,
  oliveDarkA,
} from '@radix-ui/colors'

// Radix scales are objects like {olive1: '#...', ..., olive12: '#...'} (alpha
// scales use {grassA1: '...'}). Map any scale to Panda's {1: {value}, ...} shape
// by sorting on the trailing step number, so values stay sourced from the
// package rather than hand-copied. See docs/adr/0001-editorial-design-system.md.
const scale = (radixScale: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(radixScale)
      .map(([key, value]) => [Number(key.match(/\d+$/u)?.[0]), {value}] as const)
      .toSorted((a, b) => Number(a[0]) - Number(b[0])),
  )

// Each semantic role resolves light -> dark automatically: base is the light
// (olive/grass) step, _dark swaps to the matching *Dark step. The _dark
// condition is driven by [data-theme=dark] on <html> (set by the no-flash theme
// script), defaulting to the system preference.
const lightDark = (base: string, dark: string) => ({value: {base, _dark: dark}})

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx,js,jsx,astro}', './pages/**/*.{ts,tsx,js,jsx,astro}'],
  exclude: [],
  conditions: {
    extend: {
      dark: '[data-theme=dark] &',
    },
  },
  theme: {
    extend: {
      tokens: {
        fonts: {
          body: {value: "'Inter Variable', system-ui, sans-serif"},
          heading: {value: "'Schibsted Grotesk Variable', 'Inter Variable', system-ui, sans-serif"},
          mono: {value: "'JetBrains Mono Variable', ui-monospace, monospace"},
        },
        colors: {
          olive: scale(olive),
          oliveA: scale(oliveA),
          oliveDark: scale(oliveDark),
          oliveDarkA: scale(oliveDarkA),
          grass: scale(grass),
          grassA: scale(grassA),
          grassDark: scale(grassDark),
          grassDarkA: scale(grassDarkA),
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            canvas: lightDark('{colors.olive.1}', '{colors.oliveDark.1}'),
            subtle: lightDark('{colors.olive.2}', '{colors.oliveDark.2}'),
            element: lightDark('{colors.olive.3}', '{colors.oliveDark.3}'),
            elementHover: lightDark('{colors.olive.4}', '{colors.oliveDark.4}'),
          },
          border: {
            subtle: lightDark('{colors.oliveA.6}', '{colors.oliveDarkA.6}'),
            DEFAULT: lightDark('{colors.oliveA.7}', '{colors.oliveDarkA.7}'),
          },
          text: {
            muted: lightDark('{colors.olive.11}', '{colors.oliveDark.11}'),
            DEFAULT: lightDark('{colors.olive.12}', '{colors.oliveDark.12}'),
          },
          accent: {
            solid: lightDark('{colors.grass.9}', '{colors.grassDark.9}'),
            solidHover: lightDark('{colors.grass.10}', '{colors.grassDark.10}'),
            text: lightDark('{colors.grass.11}', '{colors.grassDark.11}'),
          },
          focus: {
            ring: lightDark('{colors.grass.8}', '{colors.grassDark.8}'),
          },
        },
      },
      recipes: {
        prose: {
          className: 'prose',
          description: 'Long-form article body styling, shared by blog posts and the about page.',
          jsxName: 'Prose',
          base: {
            color: 'text',
            lineHeight: '1.7',
            '& h2': {fontSize: '2xl', fontWeight: 'bold', mt: '8', mb: '4', color: 'text'},
            '& h3': {fontSize: 'xl', fontWeight: 'semibold', mt: '6', mb: '3', color: 'text'},
            '& h4': {fontSize: 'md', fontWeight: 'bold', mt: '4', mb: '2', color: 'text'},
            '& p': {mb: '4', color: 'text'},
            '& a': {
              color: 'accent.text',
              textDecoration: 'underline',
              _hover: {color: 'accent.solidHover'},
            },
            '& strong': {fontWeight: 'bold', color: 'text'},
            '& blockquote': {
              borderLeftWidth: '4px',
              borderLeftColor: 'border',
              pl: '4',
              my: '4',
              fontStyle: 'italic',
              color: 'text.muted',
            },
            '& ul, & ol': {pl: '6', mb: '4', color: 'text'},
            '& li': {mb: '2'},
            '& code': {
              bg: 'bg.element',
              px: '1.5',
              py: '0.5',
              borderRadius: 'sm',
              fontSize: 'sm',
              fontFamily: 'mono',
            },
            '& pre': {bg: 'bg.subtle', p: '4', borderRadius: 'lg', overflow: 'auto', mb: '4'},
            '& pre code': {bg: 'transparent', p: '0'},
            '& img': {maxW: 'full', h: 'auto', borderRadius: 'lg', my: '6'},
          },
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
