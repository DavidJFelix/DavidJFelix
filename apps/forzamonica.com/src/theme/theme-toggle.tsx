import {css} from 'styled-system/css'

import {type ThemeMode, useTheme} from './theme-provider'

// Cycle order: each press moves to the next mode, so all three states stay
// reachable from a single button (system is never a dead end).
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

// Icon-only control matching the header's other affordances (pill border,
// paper.shade hover, the shared focusRing token) -- see SiteHeader's Cart
// link for the sibling it sits next to.
const toggleButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  width: '10',
  height: '10',
  borderRadius: 'pill',
  border: '1.5px solid',
  borderColor: 'border',
  bg: 'transparent',
  color: 'ink',
  cursor: 'pointer',
  transition:
    'background token(durations.quick) token(easings.out), border-color token(durations.quick) token(easings.out)',
  _hover: {bg: 'paper.shade'},
  _focusVisible: {
    borderColor: 'focusRing',
    boxShadow: '0 0 0 3px color-mix(in srgb, token(colors.focusRing) 30%, transparent)',
  },
})

// Each icon reflects the raw mode (not the resolved scheme) and is shown or
// hidden by an arbitrary-selector rule keyed off the data-theme-mode
// attribute the bootstrap script sets on <html> before first paint -- so the
// right icon renders before hydration, with no JS-driven flash. Panda's
// static analysis extracts css() calls by parsing the literal object at each
// call site, so the selector keys are written out per mode rather than
// built from a variable.
const ICON_LIGHT = css({display: 'none', '[data-theme-mode=light] &': {display: 'block'}})
const ICON_DARK = css({display: 'none', '[data-theme-mode=dark] &': {display: 'block'}})
const ICON_SYSTEM = css({display: 'none', '[data-theme-mode=system] &': {display: 'block'}})

export function ThemeToggle() {
  const {mode, setMode} = useTheme()
  // Until mounted the mode is unknown to React (the SSR markup must be
  // deterministic), so the label falls back to the generic action. Screen
  // readers query the label at interaction time, post-hydration, where it
  // names the concrete next mode.
  const label = mode === undefined ? 'Toggle color theme' : `Switch to ${NEXT_MODE[mode]} theme`
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={toggleButton}
      onClick={() => {
        setMode(NEXT_MODE[mode ?? 'system'])
      }}
    >
      <SunIcon className={ICON_LIGHT} />
      <MoonIcon className={ICON_DARK} />
      <MonitorIcon className={ICON_SYSTEM} />
    </button>
  )
}

// Feather-style outline marks (MIT), matching index.tsx's inline social
// icons: 24x24 viewBox, currentColor stroke, scaled down to 18px.
function SunIcon({className}: {className: string}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon({className}: {className: string}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

function MonitorIcon({className}: {className: string}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
