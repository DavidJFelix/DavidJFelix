import {useStableCallback} from '@pierre/diffs/react'
import {type ColorMode} from '@pierre/theming'
import {useSelector, useStore} from '@xstate/store-react'
import {useEffect, useMemo} from 'react'

import type {DarkThemeName, LightThemeName} from '@/diffs/lib/theme-names'
import {
  type ThemeCycleDurationSeconds,
  type ThemeSelection,
  themeCycleLogic,
} from '@/diffs/state/theme-cycle-store'

export interface ThemeCycleControls {
  cycling: boolean
  stepSeconds: ThemeCycleDurationSeconds
  bumpDuration: () => void
  toggleCycle: () => void
}

interface UseThemeCycleArgs extends ThemeSelection {
  setLightThemeName: (theme: LightThemeName) => void
  setDarkThemeName: (theme: DarkThemeName) => void
  setColorMode: (mode: ColorMode) => void
}

// Sweeps through every theme of the catalog, so that a visitor can preview all
// of them without a pick for each one.
export function useThemeCycle({
  lightThemeName,
  darkThemeName,
  resolvedThemeMode,
  setLightThemeName,
  setDarkThemeName,
  setColorMode,
}: UseThemeCycleArgs): ThemeCycleControls {
  const store = useStore(themeCycleLogic)
  const cycling = useSelector(store, ({context}) => context.status === 'cycling')
  const stepSeconds = useSelector(store, ({context}) => context.stepSeconds)

  useEffect(() => {
    const subscription = store.on('stepped', ({step}) => {
      if (step.mode === 'light') {
        setLightThemeName(step.theme)
      } else {
        setDarkThemeName(step.theme)
      }
      setColorMode(step.mode)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [store, setLightThemeName, setDarkThemeName, setColorMode])

  useEffect(() => {
    if (!cycling) return undefined
    const intervalId = window.setInterval(() => {
      store.trigger.ticked()
    }, stepSeconds * 1000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [cycling, stepSeconds, store])

  const toggleCycle = useStableCallback(() => {
    store.trigger.toggled({lightThemeName, darkThemeName, resolvedThemeMode})
  })
  const bumpDuration = useStableCallback(() => {
    store.trigger.durationBumped({lightThemeName, darkThemeName, resolvedThemeMode})
  })

  return useMemo(
    () => ({cycling, stepSeconds, bumpDuration, toggleCycle}),
    [cycling, stepSeconds, bumpDuration, toggleCycle],
  )
}
