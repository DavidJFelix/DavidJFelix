import type {ReactNode} from 'react'
import {css, cx} from 'styled-system/css'

// A 36px square icon-only control. `label` is the accessible name (the glyph
// inside is decorative); the visible state comes from color, not the icon.
const base = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  w: '9',
  h: '9',
  rounded: 'lg',
  color: 'text.muted',
  cursor: 'pointer',
  transition: 'colors',
  _hover: {bg: 'bg.hover', color: 'text'},
  _focusVisible: {outline: '[2px solid]', outlineColor: 'focus.ring', outlineOffset: '[2px]'},
  _disabled: {cursor: 'not-allowed', opacity: '0.4', _hover: {bg: 'transparent'}},
})

const variants = {
  ghost: css({}),
  // The one primary action on screen: inverted like the user's own messages.
  primary: css({
    bg: 'inverse.bg',
    color: 'inverse.text',
    _hover: {bg: 'inverse.bg', color: 'inverse.text', opacity: '0.85'},
    _disabled: {_hover: {bg: 'inverse.bg', opacity: '0.4'}},
  }),
}

export interface IconButtonProps {
  label: string
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: keyof typeof variants
  disabled?: boolean
  className?: string
}

export function IconButton({
  label,
  children,
  onClick,
  type = 'button',
  variant = 'ghost',
  disabled = false,
  className,
}: IconButtonProps) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(base, variants[variant], className)}
    >
      {children}
    </button>
  )
}
