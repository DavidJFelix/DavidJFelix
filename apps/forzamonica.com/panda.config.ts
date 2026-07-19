import {defineConfig, defineRecipe, defineSlotRecipe} from '@pandacss/dev'

// Tokens and recipes ported from the forzamonica art design system
// (claude.ai/design project, ui_kits/shop): cool paper-white + ink base,
// pastel "pigment" chips, Newsreader display italic over Karla UI sans.

// Plain `button` recipe -- Ark UI has no Button component, so this is a styled
// native <button>. Used directly and as the base for trigger slots elsewhere.
// Every visual carries a 1.5px border (transparent on primary) so all three
// variants share the same box size.
const button = defineRecipe({
  className: 'button',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    border: '1.5px solid transparent',
    borderRadius: 'pill',
    fontWeight: 'bold',
    lineHeight: '1.2',
    cursor: 'pointer',
    transition:
      'background token(durations.quick) token(easings.out), color token(durations.quick) token(easings.out)',
    _disabled: {opacity: 0.45, cursor: 'not-allowed'},
  },
  variants: {
    visual: {
      primary: {
        bg: 'ink',
        color: 'paper',
        _hover: {bg: 'ink.hover'},
        _disabled: {_hover: {bg: 'ink'}},
      },
      secondary: {
        bg: 'transparent',
        color: 'ink',
        borderColor: 'ink',
        _hover: {bg: 'paper.shade'},
      },
      ghost: {
        bg: 'transparent',
        color: 'ink',
        textDecoration: 'underline',
        textUnderlineOffset: '4px',
        _hover: {color: 'pigment.sky.deep'},
      },
    },
    size: {
      sm: {fontSize: '13px', px: '14.5px', py: '6.5px'},
      md: {fontSize: '15px', px: '22.5px', py: '10.5px'},
    },
  },
  defaultVariants: {visual: 'primary', size: 'md'},
})

// Pastel pigment chip.
const badge = defineRecipe({
  className: 'badge',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    fontSize: '12px',
    fontWeight: 'bold',
    lineHeight: '1.2',
    color: 'ink',
    borderRadius: 'pill',
    px: '2.5',
    py: '1',
  },
  variants: {
    tone: {
      sky: {bg: 'pigment.sky'},
      rose: {bg: 'pigment.rose'},
      butter: {bg: 'pigment.butter'},
      sage: {bg: 'pigment.sage'},
    },
  },
  defaultVariants: {tone: 'sky'},
})

// White surface card; padding stays with the caller.
const card = defineRecipe({
  className: 'card',
  base: {
    bg: 'surface',
    border: '1px solid',
    borderColor: 'border',
    borderRadius: 'card',
  },
})

// Gallery filter chip (rendered as a link).
const chip = defineRecipe({
  className: 'chip',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1.5px solid',
    borderRadius: 'pill',
    px: '4',
    py: '7px',
    cursor: 'pointer',
    transition:
      'background token(durations.quick) token(easings.out), border-color token(durations.quick) token(easings.out)',
  },
  variants: {
    selected: {
      true: {color: 'paper', bg: 'ink', borderColor: 'ink'},
      false: {
        color: 'ink',
        bg: 'surface',
        borderColor: 'border',
        _hover: {borderColor: 'border.strong'},
      },
    },
  },
  defaultVariants: {selected: false},
})

// Labeled form field: shared skin for native input/select/textarea controls.
const field = defineSlotRecipe({
  className: 'field',
  slots: ['root', 'label', 'control', 'hint', 'error'],
  base: {
    root: {display: 'flex', flexDirection: 'column', gap: '1.5'},
    label: {fontSize: '13px', fontWeight: 'bold', color: 'ink'},
    control: {
      fontFamily: 'sans',
      fontSize: '15px',
      color: 'ink',
      bg: 'surface',
      border: '1.5px solid',
      borderColor: 'border',
      borderRadius: 'input',
      px: '3.5',
      py: '11px',
      outline: 'none',
      width: 'full',
      transition: 'border-color token(durations.quick) token(easings.out)',
      _focus: {borderColor: 'focusRing'},
      _placeholder: {color: 'ink.faint'},
    },
    hint: {fontSize: '12px', color: 'ink.muted'},
    error: {fontSize: '12px', color: 'error'},
  },
})

// Slot recipe for Ark UI's NumberInput, used as the cart quantity stepper.
// This is the reference pattern for styling Ark components in this repo:
// one slot recipe per component, classes applied per-part. Skinned as the
// design system's pill stepper: minus / count / plus in one pill.
const quantityField = defineSlotRecipe({
  className: 'quantityField',
  slots: ['root', 'label', 'control', 'input', 'incrementTrigger', 'decrementTrigger'],
  base: {
    root: {display: 'flex', flexDirection: 'column', gap: '1'},
    label: {fontSize: '13px', fontWeight: 'bold', color: 'ink'},
    control: {
      display: 'inline-flex',
      alignItems: 'center',
      border: '1.5px solid',
      borderColor: 'border.strong',
      borderRadius: 'pill',
      bg: 'surface',
    },
    input: {
      width: '10',
      textAlign: 'center',
      border: 'none',
      outline: 'none',
      fontSize: '15px',
      fontWeight: 'bold',
      color: 'ink',
      bg: 'transparent',
    },
    incrementTrigger: {
      width: '9',
      height: '9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'ink',
      cursor: 'pointer',
      _disabled: {opacity: 0.35, cursor: 'not-allowed'},
    },
    decrementTrigger: {
      width: '9',
      height: '9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'ink',
      cursor: 'pointer',
      _disabled: {opacity: 0.35, cursor: 'not-allowed'},
    },
  },
})

export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-panda'],
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  jsxFramework: 'react',
  outdir: 'styled-system',
  theme: {
    extend: {
      recipes: {button, badge, card, chip},
      slotRecipes: {field, quantityField},
      tokens: {
        fonts: {
          display: {value: '"Newsreader", Georgia, serif'},
          sans: {value: '"Karla", "Helvetica Neue", Arial, sans-serif'},
        },
        colors: {
          paper: {
            DEFAULT: {value: '#f7f9fa'},
            shade: {value: '#eef2f4'},
          },
          surface: {value: '#ffffff'},
          ink: {
            DEFAULT: {value: '#1e2a3a'},
            muted: {value: '#5b6a7c'},
            faint: {value: '#8a97a6'},
            hover: {value: '#31445c'},
          },
          border: {
            DEFAULT: {value: '#d4dbe1'},
            strong: {value: '#aeb9c4'},
          },
          // Pigment pastels share one lightness/chroma (oklch 0.85 / 0.07);
          // only hue varies. Deeps are the small-accent counterparts.
          pigment: {
            rose: {
              DEFAULT: {value: 'oklch(0.85 0.07 20)'},
              deep: {value: 'oklch(0.55 0.12 20)'},
            },
            butter: {value: 'oklch(0.85 0.07 95)'},
            sage: {
              DEFAULT: {value: 'oklch(0.85 0.07 150)'},
              deep: {value: 'oklch(0.55 0.12 150)'},
            },
            sky: {
              DEFAULT: {value: 'oklch(0.85 0.07 230)'},
              deep: {value: 'oklch(0.55 0.12 250)'},
            },
          },
        },
        sizes: {
          page: {value: '1160px'},
        },
        radii: {
          pill: {value: '999px'},
          card: {value: '14px'},
          input: {value: '10px'},
          media: {value: '10px'},
        },
        shadows: {
          card: {value: '0 2px 16px rgba(30, 42, 58, 0.10)'},
          lift: {value: '0 6px 24px rgba(30, 42, 58, 0.14)'},
          pop: {value: '0 12px 40px rgba(30, 42, 58, 0.18)'},
        },
        easings: {
          out: {value: 'cubic-bezier(0.22, 1, 0.36, 1)'},
        },
        durations: {
          quick: {value: '150ms'},
          soft: {value: '250ms'},
        },
      },
      semanticTokens: {
        colors: {
          fg: {
            DEFAULT: {value: '{colors.ink}'},
            muted: {value: '{colors.ink.muted}'},
          },
          canvas: {value: '{colors.paper}'},
          focusRing: {value: '{colors.pigment.sky.deep}'},
          success: {value: '{colors.pigment.sage.deep}'},
          error: {value: '{colors.pigment.rose.deep}'},
        },
      },
      textStyles: {
        // Display voice: Newsreader italic 500 -- warm and hand-made.
        displayXl: {
          value: {
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: '44px',
            lineHeight: '1.05',
          },
        },
        displayLg: {
          value: {
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: '32px',
            lineHeight: '1.1',
          },
        },
        displayMd: {
          value: {
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: '24px',
            lineHeight: '1.2',
          },
        },
        title: {
          value: {
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: '20px',
            lineHeight: '1.3',
          },
        },
        quote: {
          value: {
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: '400',
            fontSize: '16px',
            lineHeight: '1.5',
          },
        },
        overline: {
          value: {
            fontFamily: 'sans',
            fontWeight: '700',
            fontSize: '12px',
            lineHeight: '1.2',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          },
        },
      },
    },
  },
})
