import {defineConfig, defineRecipe} from '@pandacss/dev'

// Status badge tones map 1:1 to $lib/state's StatusTone union.
const badge = defineRecipe({
  className: 'badge',
  base: {
    display: 'inline-block',
    px: '0.55rem',
    py: '0.1rem',
    borderRadius: 'full',
    fontSize: '0.75rem',
    fontWeight: '500',
    letterSpacing: '0.02em',
  },
  variants: {
    tone: {
      ok: {color: 'ok', bg: 'ok.subtle'},
      busy: {color: 'busy', bg: 'busy.subtle'},
      warn: {color: 'warn', bg: 'warn.subtle'},
      unknown: {color: 'muted', bg: 'unknown.subtle'},
    },
  },
  defaultVariants: {tone: 'unknown'},
})

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,svelte}'],
  outdir: 'styled-system',
  // The badge tone is selected at runtime from statusTone(), so static
  // extraction cannot see the variants -- emit them all.
  staticCss: {
    recipes: {
      badge: [{tone: ['*']}],
    },
  },
  theme: {
    extend: {
      recipes: {badge},
      semanticTokens: {
        colors: {
          bg: {value: {base: '#fafaf8', _osDark: '#16181d'}},
          surface: {value: {base: '#ffffff', _osDark: '#1e2128'}},
          border: {value: {base: '#e4e4e0', _osDark: '#2c3038'}},
          text: {value: {base: '#26282c', _osDark: '#d8dade'}},
          muted: {value: {base: '#71747c', _osDark: '#8b8f99'}},
          accent: {value: {base: '#5b4a8f', _osDark: '#a795e0'}},
          ok: {
            DEFAULT: {value: {base: '#1a7f4b', _osDark: '#4cc38a'}},
            subtle: {value: {base: '#e6f5ec', _osDark: '#14301f'}},
          },
          busy: {
            DEFAULT: {value: {base: '#946200', _osDark: '#e0b45c'}},
            subtle: {value: {base: '#fdf3dd', _osDark: '#33270e'}},
          },
          warn: {
            DEFAULT: {value: {base: '#a13a2f', _osDark: '#e08579'}},
            subtle: {value: {base: '#fbe9e6', _osDark: '#331713'}},
          },
          unknown: {
            subtle: {value: {base: '#ededeb', _osDark: '#262a31'}},
          },
        },
      },
    },
  },
  globalCss: {
    body: {
      margin: 0,
      bg: 'bg',
      color: 'text',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      lineHeight: '1.5',
    },
    a: {
      color: 'accent',
      textDecoration: 'none',
      _hover: {textDecoration: 'underline'},
    },
    'code, pre': {
      fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      fontSize: '0.85rem',
    },
  },
})
