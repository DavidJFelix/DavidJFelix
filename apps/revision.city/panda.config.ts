import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  conditions: {
    extend: {
      // Match the diffs viewer's class-based color scheme exactly: `.dark` on
      // <html> (set pre-paint by the theme bootstrap script) or on a portal
      // container element itself.
      dark: '&:is(.dark *, .dark)',
      light: '&:is(.light *)',
    },
  },
  theme: {
    extend: {
      // Enter/exit motion for popover surfaces (dropdown menus). The slide
      // offset arrives via --menu-slide-x/y so one keyframe pair covers all
      // four sides.
      keyframes: {
        menuIn: {
          from: {
            opacity: '0',
            transform:
              'translate(var(--menu-slide-x, 0), var(--menu-slide-y, 0)) scale(0.95)',
          },
          to: {opacity: '1', transform: 'translate(0, 0) scale(1)'},
        },
        menuOut: {
          from: {opacity: '1', transform: 'translate(0, 0) scale(1)'},
          to: {
            opacity: '0',
            transform:
              'translate(var(--menu-slide-x, 0), var(--menu-slide-y, 0)) scale(0.95)',
          },
        },
      },
      semanticTokens: {
        // The diffs feature's theme contract: tokens resolve to the CSS
        // variables defined in src/diffs/diffs.css (light/dark blocks), which
        // only loads on /diffs routes. Namespaced under `diffs` so the rest of
        // the app keeps the plain Panda palette.
        colors: {
          diffs: {
            background: {value: 'var(--background)'},
            foreground: {value: 'var(--foreground)'},
            popover: {
              DEFAULT: {value: 'var(--popover)'},
              foreground: {value: 'var(--popover-foreground)'},
            },
            primary: {
              DEFAULT: {value: 'var(--primary)'},
              foreground: {value: 'var(--primary-foreground)'},
            },
            secondary: {
              DEFAULT: {value: 'var(--secondary)'},
              foreground: {value: 'var(--secondary-foreground)'},
            },
            muted: {
              DEFAULT: {value: 'var(--muted)'},
              foreground: {value: 'var(--muted-foreground)'},
            },
            accent: {
              DEFAULT: {value: 'var(--accent)'},
              foreground: {value: 'var(--accent-foreground)'},
            },
            destructive: {value: 'var(--destructive)'},
            border: {
              DEFAULT: {value: 'var(--border)'},
              opaque: {value: 'var(--border-opaque)'},
            },
            input: {value: 'var(--input)'},
            ring: {value: 'var(--ring)'},
            sidebar: {value: 'var(--diffs-sidebar-bg)'},
          },
        },
        radii: {
          diffs: {
            sm: {value: 'calc(var(--radius) - 4px)'},
            md: {value: 'calc(var(--radius) - 2px)'},
            lg: {value: 'var(--radius)'},
            xl: {value: 'calc(var(--radius) + 4px)'},
          },
        },
        fonts: {
          diffs: {
            sans: {value: 'var(--font-geist-sans)'},
            mono: {value: 'var(--font-jetbrains-mono)'},
          },
        },
      },
    },
  },
})
