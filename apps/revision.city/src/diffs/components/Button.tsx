import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import { cva, cx, type RecipeVariantProps } from 'styled-system/css';

// Focus ring approximating Tailwind's ring utilities: a 3px box-shadow in the
// ring color at partial opacity.
const FOCUS_RING_SHADOW =
  '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)';
const SHADOW_XS = '0 1px 2px 0 rgb(0 0 0 / 0.05)';

const buttonVariants = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    whiteSpace: 'nowrap',
    rounded: 'diffs.md',
    fontSize: 'sm',
    lineHeight: '1.25rem',
    fontWeight: 'medium',
    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: '0',
    outline: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    '& svg': { pointerEvents: 'none', flexShrink: '0' },
    _disabled: { pointerEvents: 'none', opacity: '0.5', boxShadow: 'none' },
    _focusVisible: {
      borderColor: 'diffs.ring',
      boxShadow: FOCUS_RING_SHADOW,
    },
    '&[aria-invalid="true"]': {
      borderColor: 'diffs.destructive',
      boxShadow:
        '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
      _dark: {
        boxShadow:
          '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
  },
  variants: {
    variant: {
      default: {
        bg: 'diffs.primary',
        color: 'diffs.primary.foreground',
        _hover: { bg: 'diffs.primary/90' },
      },
      success: {
        bg: 'teal.500',
        color: 'white',
        _hover: { bg: 'teal.500/90' },
        _focusVisible: {
          boxShadow:
            '0 0 0 3px color-mix(in oklab, token(colors.teal.500) 20%, transparent)',
        },
        _dark: {
          bg: 'green.500/60',
          _focusVisible: {
            boxShadow:
              '0 0 0 3px color-mix(in oklab, token(colors.green.500) 40%, transparent)',
          },
        },
      },
      destructive: {
        bg: 'diffs.destructive',
        color: 'white',
        _hover: { bg: 'diffs.destructive/90' },
        _focusVisible: {
          boxShadow:
            '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
        },
        _dark: {
          bg: 'diffs.destructive/60',
          _focusVisible: {
            boxShadow:
              '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
          },
        },
      },
      outline: {
        borderWidth: '1px',
        bg: 'diffs.background',
        boxShadow: SHADOW_XS,
        _hover: { bg: 'diffs.secondary', color: 'diffs.accent.foreground' },
        _dark: {
          borderColor: 'neutral.800',
          _hover: { bg: 'diffs.input/50' },
        },
      },
      secondary: {
        bg: 'diffs.secondary',
        color: 'diffs.secondary.foreground',
        _hover: { bg: 'diffs.secondary/80' },
      },
      tertiary: {
        bg: 'neutral.900/10',
        boxShadow: 'none',
      },
      muted: {
        bg: 'diffs.secondary',
        color: 'diffs.accent.foreground/75',
        _hover: { color: 'diffs.accent.foreground' },
      },
      ghost: {
        borderWidth: '1px',
        bg: 'transparent',
        borderColor: 'transparent',
        _hover: { bg: 'diffs.accent', color: 'diffs.accent.foreground' },
        _dark: { _hover: { bg: 'diffs.accent/50' } },
      },
      link: {
        color: 'diffs.primary',
        textUnderlineOffset: '4px',
        _hover: { textDecorationLine: 'underline' },
      },
    },
    size: {
      xs: {
        h: '5.5',
        rounded: 'diffs.sm',
        gap: '1.5',
        px: '1.5',
        fontSize: 'xs',
        lineHeight: '1rem',
      },
      default: { h: '9', px: '3.5', py: '2', rounded: 'diffs.lg' },
      sm: { h: '8', rounded: 'diffs.md', gap: '1.5', px: '3' },
      lg: { h: '10', rounded: 'diffs.md', px: '6' },
      xl: { h: '11', rounded: 'diffs.md', px: '7' },
      icon: { w: '9', h: '9' },
      'icon-md': { w: '8', h: '8', rounded: 'diffs.md' },
      'icon-sm': { w: '5', h: '5', rounded: 'diffs.sm' },
      'icon-only': { w: '4', h: '4', rounded: '0', p: '0' },
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = React.ComponentProps<'button'> &
  RecipeVariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cx(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
