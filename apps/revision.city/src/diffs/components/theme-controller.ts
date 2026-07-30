import {createThemeController, type ThemePersistence} from '@pierre/theming'
import * as z from 'zod/mini'
import {isNullish} from '@/diffs/lib/nullish'
import {docsThemeCatalog} from './theme-catalog'

// The repo theming contract's storage schema (zod 4, see
// docs/projects/theme-switcher-unification/plan.md): the mode key holds a raw
// string -- never JSON, the pre-paint bootstrap reads it without parsing --
// and anything invalid parses to system. The literal check in
// lib/theme-bootstrap.ts is this schema's compiled twin; keep them agreeing.
const themeModeSchema = z.catch(z.enum(['light', 'dark', 'system']), 'system')

export {docsThemeCatalog} from './theme-catalog'

// The single owner of the diffs app's theming state. Color mode (light/
// dark/system), the light/dark theme-name picks, and their persistence all
// live here, so there is no parallel state ownership. The controller creates
// and owns the resolver; consumers that need an explicit resolver use the
// docsThemeResolver alias below rather than creating a second cache.
//
// It is a module singleton: created once per process on the server (where the
// browser guards make it a constant) and once per page-load on the client,
// surviving client-side navigation.

// The persistence keys the pre-paint no-flash bootstrap script (which reads
// `theme`) and existing users' saved selections depend on, so changing them
// would orphan saved preferences.
// TODO(theming): migrate off these legacy keys and use
// createThemeController's built-in `storageKey` persistence shape instead.
const MODE_KEY = 'theme'
const LIGHT_THEME_KEY = 'diffs-light-theme'
const DARK_THEME_KEY = 'diffs-dark-theme'

function readKey(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeKey(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Storage may be unavailable (private mode / denied) — non-fatal.
  }
}

// Maps the controller's selection onto the app's three storage keys: mode as a
// plain `light`/`dark`/`system` string under `theme` (what the bootstrap script
// reads), and the theme names under the diffs-prefixed keys.
const docsPersistence: ThemePersistence = {
  load() {
    const mode = readKey(MODE_KEY)
    const light = readKey(LIGHT_THEME_KEY)
    const dark = readKey(DARK_THEME_KEY)
    if (isNullish(mode) && isNullish(light) && isNullish(dark)) return null
    const validMode = themeModeSchema.parse(mode)
    return {
      mode: validMode,
      lightThemeName: light ?? docsThemeCatalog.defaultLightThemeName,
      darkThemeName: dark ?? docsThemeCatalog.defaultDarkThemeName,
    }
  },
  save(selection) {
    writeKey(MODE_KEY, selection.mode)
    writeKey(LIGHT_THEME_KEY, selection.lightThemeName)
    writeKey(DARK_THEME_KEY, selection.darkThemeName)
  },
}

export const themeController = createThemeController({
  catalog: docsThemeCatalog,
  persistence: docsPersistence,
  defaultMode: 'system',
})

// Cross-tab sync (repo theming contract): @pierre/theming has no storage
// listener of its own, so another tab's saved selection is adopted here. The
// re-save the setters trigger writes identical values, which never re-fires
// the storage event in other tabs, so this cannot loop.
function handleStorage(event: StorageEvent): void {
  const relevant =
    event.key === null ||
    event.key === MODE_KEY ||
    event.key === LIGHT_THEME_KEY ||
    event.key === DARK_THEME_KEY
  if (!relevant) return
  const selection = docsPersistence.load()
  themeController.setColorMode(selection?.mode ?? 'system')
  themeController.setThemeNameForScheme(
    'light',
    selection?.lightThemeName ?? docsThemeCatalog.defaultLightThemeName,
  )
  themeController.setThemeNameForScheme(
    'dark',
    selection?.darkThemeName ?? docsThemeCatalog.defaultDarkThemeName,
  )
}

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', handleStorage)
}

export const docsThemeResolver = themeController.resolver
