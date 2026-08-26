import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import type {ThemeColorPair} from './bootstrap'
import type {ResolvedColorScheme, ThemeMode, ThemeState} from './controller'
import {THEME_MODES, themeController} from './controller'

interface ThemeProviderProps {
  children: ReactNode
  // Per-scheme <meta name="theme-color"> content; must match the pair given to
  // createThemeBootstrapScript so pre-paint and post-hydration agree.
  themeColors?: ThemeColorPair
}

interface ThemeContextValue {
  // Undefined until mounted so render output derived from useTheme() matches
  // the SSR markup first, then flips. The pre-paint bootstrap already painted
  // the real scheme, so the gate is invisible to the user.
  mode?: ThemeMode
  modes: ThemeMode[]
  resolvedColorScheme?: ResolvedColorScheme
  setMode: (mode: ThemeMode) => void
}

// What the server renders with: the defaults every fresh client also starts
// from, so hydration output is stable regardless of the visitor's persistence.
const SERVER_STATE: ThemeState = {mode: 'system', resolvedColorScheme: 'light'}

// Consumers import the mode vocabulary from here so this binding is the one
// app-facing module; the controller stays an implementation detail.
export {NEXT_THEME_MODE, type ResolvedColorScheme, type ThemeMode} from './controller'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Points the document's theme-color meta at `color` (the iOS Safari navbar
// tint), creating the meta if the bootstrap script has not already. The meta is
// intentionally not authored in JSX: React 19 hoists head tags and would leave
// a duplicate next to the one the bootstrap owns.
function setThemeColorMeta(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (meta === null) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    // appendChild, not append: @cloudflare/workers-types merges its
    // HTMLRewriter Element into the global, and its append() signature wins.
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

// Thin React binding over the theme controller (the single owner of theming
// state). Subscribes for mode + resolved scheme, applies the resolved scheme to
// <html> on change, and exposes the useTheme() API. Holds no theming state of
// its own.
export function ThemeProvider({children, themeColors}: ThemeProviderProps) {
  const state = useSyncExternalStore(
    themeController.subscribe,
    themeController.getState,
    () => SERVER_STATE,
  )

  const mounted = useSyncExternalStore(
    () => () => {}, // Subscribe - there's nothing to subscribe to
    () => true, // Client snapshot: we are hydrated
    () => false, // Server snapshot: we are not hydrated
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(state.resolvedColorScheme)
    root.style.colorScheme = state.resolvedColorScheme
    root.dataset.themeMode = state.mode
    if (themeColors !== undefined) {
      setThemeColorMeta(themeColors[state.resolvedColorScheme])
    }
  }, [state, themeColors])

  const setMode = useCallback((next: ThemeMode) => {
    themeController.setMode(next)
  }, [])

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      mode: mounted ? state.mode : undefined,
      modes: THEME_MODES,
      resolvedColorScheme: mounted ? state.resolvedColorScheme : undefined,
      setMode,
    }),
    [mounted, state, setMode],
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      modes: [],
      setMode: () => {},
    }
  )
}
