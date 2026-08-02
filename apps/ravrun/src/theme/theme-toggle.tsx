import {NEXT_THEME_MODE, useTheme} from '@davidjfelix/theme/react'

// The icon reflects the raw mode (not the resolved scheme) and is swapped by
// CSS from the data-theme-mode attribute the bootstrap script sets pre-paint,
// so the right icon shows before hydration without a flash.
const ICON_LIGHT = 'hidden [[data-theme-mode=light]_&]:block'
const ICON_DARK = 'hidden [[data-theme-mode=dark]_&]:block'
const ICON_SYSTEM = 'hidden [[data-theme-mode=system]_&]:block'

// ravrun has no icon library (unlike f311x's lucide-react): these mirror
// lucide's sun/moon/monitor glyphs as plain inline SVG.
function IconBase({className, children}: {className: string; children: React.ReactNode}) {
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
      {children}
    </svg>
  )
}

function SunIcon() {
  return (
    <IconBase className={ICON_LIGHT}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </IconBase>
  )
}

function MoonIcon() {
  return (
    <IconBase className={ICON_DARK}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </IconBase>
  )
}

function MonitorIcon() {
  return (
    <IconBase className={ICON_SYSTEM}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </IconBase>
  )
}

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
      className="ml-auto self-center rounded border border-gray-400 p-1.5 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-600 dark:hover:bg-gray-800"
      onClick={() => {
        setMode(NEXT_THEME_MODE[mode ?? 'system'])
      }}
    >
      <SunIcon />
      <MoonIcon />
      <MonitorIcon />
    </button>
  )
}
