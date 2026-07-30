// The single client-side owner of the app's color-scheme state: the selected
// mode (light/dark/system), its resolution against the OS preference, and its
// persistence. Framework bindings (theme-provider.tsx) subscribe here rather
// than holding parallel state.
//
// createThemeController is safe to call during SSR: without localStorage or
// matchMedia it settles on system/light and registers no listeners. On the
// client it tracks live OS preference changes (matchMedia change) and other
// tabs' choices (the storage event), so every open tab agrees.

import * as z from 'zod/mini'

// The storage schema for the repo theming contract: the `theme` key holds one
// of these raw strings -- never JSON, because the pre-paint bootstrap must
// read it without parsing -- and anything else (absent, cleared, garbage)
// parses to system. zod/mini keeps the client bundle cost to the schema used.
// The bootstrap's self-contained literal check in theme-bootstrap.ts is this
// schema's compiled twin; keep the two in agreement.
const themeModeEnum = z.enum(['light', 'dark', 'system'])
export const themeModeSchema = z.catch(themeModeEnum, 'system')

export type ThemeMode = z.infer<typeof themeModeEnum>
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

export const THEME_MODES: ThemeMode[] = [...themeModeEnum.options]

function readStoredMode(storageKey: string): ThemeMode {
  // The schema's catch absorbs invalid values; the try/catch is only for
  // storage access itself throwing (private mode / denied).
  try {
    return themeModeSchema.parse(globalThis.localStorage?.getItem(storageKey))
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
