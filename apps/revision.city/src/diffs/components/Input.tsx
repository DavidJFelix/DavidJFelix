import * as React from 'react';

import { cva, cx, type RecipeVariantProps } from 'styled-system/css';

// Sizes are kept in lockstep with `Button` so an Input + Button paired in the
// same row line up at the same height/radius/padding rhythm.
const inputVariants = cva({
  base: {
    w: 'full',
    minW: '0',
    borderWidth: '1px',
    borderColor: 'diffs.input',
    bg: 'transparent',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    transition:
      'color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    _placeholder: { color: 'diffs.muted.foreground' },
    _selection: { bg: 'diffs.primary', color: 'diffs.primary.foreground' },
    _dark: { bg: 'diffs.input/30' },
    '&::file-selector-button': {
      color: 'diffs.foreground',
      display: 'inline-flex',
      borderWidth: '0',
      bg: 'transparent',
      fontWeight: 'medium',
    },
    _disabled: {
      pointerEvents: 'none',
      cursor: 'not-allowed',
      opacity: '0.5',
    },
    _focusVisible: {
      borderColor: 'diffs.ring',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
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
    inputSize: {
      default: {
        h: '9',
        rounded: 'diffs.md',
        px: '3',
        py: '1',
        fontSize: { base: 'base', md: 'sm' },
        lineHeight: { base: '1.5rem', md: '1.25rem' },
        '&::file-selector-button': {
          h: '7',
          fontSize: 'sm',
          lineHeight: '1.25rem',
        },
      },
      lg: {
        h: '10',
        rounded: 'diffs.md',
        px: '4',
        fontSize: 'base',
        lineHeight: '1.5rem',
        '&::file-selector-button': {
          h: '8',
          fontSize: 'sm',
          lineHeight: '1.25rem',
        },
      },
      sm: {
        h: '8',
        rounded: 'diffs.md',
        px: '2',
        py: '1',
        fontSize: 'xs',
        lineHeight: '1rem',
      },
    },
  },
  defaultVariants: {
    inputSize: 'default',
  },
});

// `inputSize` is used instead of `size` because `size` is a native HTML input
// attribute (character-width hint) and we don't want our variant prop to
// shadow it.
export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  RecipeVariantProps<typeof inputVariants>;

function Input({ className, type, inputSize, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cx(inputVariants({ inputSize }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
