import {defineConfig, defineRecipe, defineSlotRecipe} from '@pandacss/dev'

// Plain `button` recipe -- Ark UI has no Button component, so this is a styled
// native <button>. Used directly and as the base for trigger slots elsewhere.
const button = defineRecipe({
  className: 'button',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    borderRadius: 'md',
    fontWeight: 'semibold',
    cursor: 'pointer',
    transition: 'background 0.15s ease, border-color 0.15s ease',
    _disabled: {opacity: 0.5, cursor: 'not-allowed'},
  },
  variants: {
    visual: {
      solid: {
        bg: 'brand',
        color: 'brand.fg',
        border: '1px solid transparent',
        _hover: {bg: 'brand.emphasized'},
      },
      outline: {
        bg: 'transparent',
        color: 'fg',
        border: '1px solid',
        borderColor: 'neutral.300',
        _hover: {borderColor: 'neutral.500'},
      },
    },
    size: {
      sm: {px: '3', py: '1.5', fontSize: 'sm'},
      md: {px: '5', py: '2.5', fontSize: 'md'},
    },
  },
  defaultVariants: {visual: 'solid', size: 'md'},
})

// Slot recipe for Ark UI's NumberInput, used as the cart quantity stepper.
// This is the reference pattern for styling Ark components in this repo:
// one slot recipe per component, classes applied per-part.
const quantityField = defineSlotRecipe({
  className: 'quantityField',
  slots: ['root', 'label', 'control', 'input', 'incrementTrigger', 'decrementTrigger'],
  base: {
    root: {display: 'flex', flexDirection: 'column', gap: '1'},
    label: {fontSize: 'sm', color: 'fg.muted'},
    control: {
      display: 'inline-flex',
      alignItems: 'stretch',
      border: '1px solid',
      borderColor: 'neutral.300',
      borderRadius: 'md',
      overflow: 'hidden',
    },
    input: {
      width: '12',
      textAlign: 'center',
      border: 'none',
      outline: 'none',
      fontSize: 'md',
      color: 'fg',
      bg: 'transparent',
    },
    incrementTrigger: {
      px: '3',
      cursor: 'pointer',
      bg: 'neutral.100',
      _hover: {bg: 'neutral.200'},
      _disabled: {opacity: 0.5, cursor: 'not-allowed'},
    },
    decrementTrigger: {
      px: '3',
      cursor: 'pointer',
      bg: 'neutral.100',
      _hover: {bg: 'neutral.200'},
      _disabled: {opacity: 0.5, cursor: 'not-allowed'},
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
      recipes: {button},
      slotRecipes: {quantityField},
      semanticTokens: {
        colors: {
          brand: {
            DEFAULT: {value: '{colors.red.600}'},
            emphasized: {value: '{colors.red.700}'},
            fg: {value: '{colors.white}'},
          },
          fg: {
            DEFAULT: {value: '{colors.neutral.900}'},
            muted: {value: '{colors.neutral.600}'},
          },
          canvas: {value: '{colors.white}'},
        },
      },
    },
  },
})
