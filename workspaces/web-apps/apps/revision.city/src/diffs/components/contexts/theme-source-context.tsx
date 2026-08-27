import {createContext, useContext, useRef, useSyncExternalStore} from 'react'
import {isNullish} from '@/diffs/lib/nullish'
import type {ActiveThemeSnapshot, ThemeSource} from '@/diffs/lib/theme/theme-source'

const EMPTY_SNAPSHOT: ActiveThemeSnapshot = {
  theme: undefined,
  colorScheme: 'light',
}

export const ThemeSourceContext = createContext<ThemeSource | undefined>(undefined)

function snapshotsEqual(a: ActiveThemeSnapshot, b: ActiveThemeSnapshot): boolean {
  return a.theme === b.theme && a.colorScheme === b.colorScheme
}

export function useThemeSource(override?: ThemeSource): {
  activeTheme: ActiveThemeSnapshot
  source: ThemeSource | undefined
} {
  const contextSource = useContext(ThemeSourceContext)
  const source = override ?? contextSource
  // Cache the last snapshot so identical reads return the same reference; the
  // source may allocate a new object on every getSnapshot call.
  const cacheRef = useRef<ActiveThemeSnapshot>(EMPTY_SNAPSHOT)
  const getSnapshot = () => {
    const next = isNullish(source) ? EMPTY_SNAPSHOT : source.getSnapshot()
    if (!snapshotsEqual(cacheRef.current, next)) {
      cacheRef.current = next
    }
    return cacheRef.current
  }
  const activeTheme = useSyncExternalStore(
    (listener) => (isNullish(source) ? () => {} : source.subscribe(listener)),
    getSnapshot,
    () => EMPTY_SNAPSHOT,
  )
  return {activeTheme, source}
}
