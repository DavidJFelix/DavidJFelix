// The single client-side owner of the app's color-scheme state: the selected
// mode (light/dark/system), its resolution against the OS preference, and its
// persistence. Framework bindings (theme-provider.tsx) subscribe here rather
// than holding parallel state.
//
// createThemeController is safe to call during SSR: without localStorage or
// matchMedia it settles on system/light and registers no listeners. On the
// client it tracks live OS preference changes (matchMedia change) and other
// tabs' choices (the storage event), so every open tab agrees.

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedColorScheme = 'light' | 'dark'

export interface ThemeState {
  mode: ThemeMode
  resolvedColorScheme: ResolvedColorScheme
}

export interface ThemeController {
  getState(): ThemeState
  setMode(mode: ThemeMode): void
  subscribe(listener: () => void): () => void
  destroy(): void
}

export interface ThemeControllerOptions {
  storageKey?: string
}

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredMode(storageKey: string): ThemeMode {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey) ?? null
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writeStoredMode(storageKey: string, mode: ThemeMode): void {
  try {
    globalThis.localStorage?.setItem(storageKey, mode)
  } catch {
    // Storage may be unavailable (private mode / denied) -- non-fatal.
  }
}

function systemPrefersDark(): boolean {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

function resolveScheme(mode: ThemeMode): ResolvedColorScheme {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

export function createThemeController(options: ThemeControllerOptions = {}): ThemeController {
  const {storageKey = 'theme'} = options
  const listeners = new Set<() => void>()

  let mode = readStoredMode(storageKey)
  // The snapshot object is replaced only when its contents change, so React's
  // useSyncExternalStore can use it for referential equality checks.
  let state: ThemeState = {mode, resolvedColorScheme: resolveScheme(mode)}

  function publish(): void {
    const next: ThemeState = {mode, resolvedColorScheme: resolveScheme(mode)}
    if (next.mode === state.mode && next.resolvedColorScheme === state.resolvedColorScheme) {
      return
    }
    state = next
    for (const listener of listeners) {
      listener()
    }
  }

  function handleMediaChange(): void {
    if (mode === 'system') {
      publish()
    }
  }

  function handleStorage(event: StorageEvent): void {
    // key === null means the whole store was cleared; re-read either way.
    if (event.key !== null && event.key !== storageKey) {
      return
    }
    mode = readStoredMode(storageKey)
    publish()
  }

  const mediaQuery =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-color-scheme: dark)')
      : undefined
  mediaQuery?.addEventListener('change', handleMediaChange)
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('storage', handleStorage)
  }

  return {
    getState() {
      return state
    },
    setMode(next) {
      writeStoredMode(storageKey, next)
      mode = next
      publish()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    destroy() {
      mediaQuery?.removeEventListener('change', handleMediaChange)
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('storage', handleStorage)
      }
      listeners.clear()
    },
  }
}

// Module singleton: created once per process on the server (where the browser
// guards make it inert) and once per page-load on the client, surviving SPA
// navigation.
export const themeController = createThemeController()
