import {Monitor, Moon, Sun} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {type ThemeMode, useTheme} from '@/theme/theme-provider'

// Cycle order: each press moves to the next mode, so all three states stay
// reachable from a single button (system is never a dead end).
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

// The icon reflects the raw mode (not the resolved scheme) and is swapped by
// CSS from the data-theme-mode attribute the bootstrap script sets pre-paint,
// so the right icon shows before hydration without a flash.
const ICON_LIGHT = 'hidden [[data-theme-mode=light]_&]:block'
const ICON_DARK = 'hidden [[data-theme-mode=dark]_&]:block'
const ICON_SYSTEM = 'hidden [[data-theme-mode=system]_&]:block'

export function ThemeToggle() {
  const {mode, setMode} = useTheme()
  // Until mounted the mode is unknown to React (the SSR markup must be
  // deterministic), so the label falls back to the generic action. Screen
  // readers query the label at interaction time, post-hydration, where it
  // names the concrete next mode.
  const label = mode === undefined ? 'Toggle color theme' : `Switch to ${NEXT_MODE[mode]} theme`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        setMode(NEXT_MODE[mode ?? 'system'])
      }}
    >
      <Sun aria-hidden className={ICON_LIGHT} />
      <Moon aria-hidden className={ICON_DARK} />
      <Monitor aria-hidden className={ICON_SYSTEM} />
    </Button>
  )
}
