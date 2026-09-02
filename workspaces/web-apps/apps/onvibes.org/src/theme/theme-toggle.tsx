import {NEXT_THEME_MODE, useTheme} from '@davidjfelix/theme/react'
import {Monitor, Moon, Sun} from 'lucide-react'
import {css} from 'styled-system/css'

const buttonClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  p: '2',
  cursor: 'pointer',
  color: 'text',
  _hover: {bg: 'neutral.100'},
  _dark: {_hover: {bg: 'neutral.900'}},
  _focusVisible: {outline: '[2px solid]', outlineColor: 'sky.500', outlineOffset: '[2px]'},
})

// The icon reflects the raw mode (not the resolved scheme) and is swapped by
// CSS from the data-theme-mode attribute the bootstrap script sets pre-paint,
// so the right icon shows before hydration without a flash. Panda extracts
// css() calls statically, so each selector is spelled out literally rather
// than built from a shared helper.
const ICON_LIGHT = css({display: 'none', '[data-theme-mode=light] &': {display: 'block'}})
const ICON_DARK = css({display: 'none', '[data-theme-mode=dark] &': {display: 'block'}})
const ICON_SYSTEM = css({display: 'none', '[data-theme-mode=system] &': {display: 'block'}})

export function ThemeToggle() {
  const {mode, setMode} = useTheme()
  // Until mounted the mode is unknown to React (the SSR markup must be
  // deterministic), so the label falls back to the generic action. Screen
  // readers query the label at interaction time, post-hydration, where it
  // names the concrete next mode.
  const label =
    mode === undefined ? 'Toggle color theme' : `Switch to ${NEXT_THEME_MODE[mode]} theme`
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClass}
      onClick={() => {
        setMode(NEXT_THEME_MODE[mode ?? 'system'])
      }}
    >
      <Sun size={18} className={ICON_LIGHT} />
      <Moon size={18} className={ICON_DARK} />
      <Monitor size={18} className={ICON_SYSTEM} />
    </button>
  )
}
