import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {docsThemeCatalog} from '@/diffs/components/theme-catalog'
import type {DarkThemeName, LightThemeName} from '@/diffs/lib/theme-names'

export const THEME_CYCLE_DURATIONS_SECONDS = [3, 0.8, 0.4, 0.1] as const

export type ThemeCycleDurationSeconds = (typeof THEME_CYCLE_DURATIONS_SECONDS)[number]

export type ThemeCycleStep =
  | {mode: 'light'; theme: LightThemeName}
  | {mode: 'dark'; theme: DarkThemeName}

export interface ThemeSelection {
  lightThemeName: LightThemeName
  darkThemeName: DarkThemeName
  // Undefined until the theme selection is hydrated. The sweep cannot start
  // before then, because it starts from the visible mode.
  resolvedThemeMode: 'light' | 'dark' | undefined
}

export type ThemeCycleContext =
  | {status: 'idle'; stepSeconds: ThemeCycleDurationSeconds}
  | {status: 'cycling'; stepSeconds: ThemeCycleDurationSeconds; step: ThemeCycleStep}

const sweep: readonly ThemeCycleStep[] = [
  ...docsThemeCatalog
    .getThemeNames({colorScheme: 'light'})
    .map((theme): ThemeCycleStep => ({mode: 'light', theme})),
  ...docsThemeCatalog
    .getThemeNames({colorScheme: 'dark'})
    .map((theme): ThemeCycleStep => ({mode: 'dark', theme})),
]

function stepAfter(step: ThemeCycleStep): ThemeCycleStep {
  const index = sweep.findIndex(({mode, theme}) => mode === step.mode && theme === step.theme)
  return sweep[(index + 1) % sweep.length]
}

function visibleStep({
  lightThemeName,
  darkThemeName,
  resolvedThemeMode,
}: ThemeSelection): ThemeCycleStep | undefined {
  if (resolvedThemeMode === undefined) {
    return undefined
  }
  return resolvedThemeMode === 'dark'
    ? {mode: 'dark', theme: darkThemeName}
    : {mode: 'light', theme: lightThemeName}
}

function nextDuration(stepSeconds: ThemeCycleDurationSeconds): ThemeCycleDurationSeconds {
  const index = THEME_CYCLE_DURATIONS_SECONDS.indexOf(stepSeconds)
  return THEME_CYCLE_DURATIONS_SECONDS[(index + 1) % THEME_CYCLE_DURATIONS_SECONDS.length]
}

export const themeCycleLogic = createStoreLogic({
  context: (): ThemeCycleContext => ({
    status: 'idle',
    stepSeconds: THEME_CYCLE_DURATIONS_SECONDS[0],
  }),
  schemas: {emitted: {stepped: z.object({step: z.custom<ThemeCycleStep>()})}},
  on: {
    toggled: (context, selection: ThemeSelection, enqueue): ThemeCycleContext | undefined => {
      if (context.status === 'cycling') {
        return {status: 'idle', stepSeconds: context.stepSeconds}
      }
      const visible = visibleStep(selection)
      if (visible === undefined) {
        return undefined
      }
      const step = stepAfter(visible)
      enqueue.emit.stepped({step})
      return {status: 'cycling', stepSeconds: context.stepSeconds, step}
    },
    ticked: (context, _event, enqueue): ThemeCycleContext | undefined => {
      if (context.status === 'idle') {
        return undefined
      }
      const step = stepAfter(context.step)
      enqueue.emit.stepped({step})
      return {...context, step}
    },
    durationBumped: (context, selection: ThemeSelection, enqueue): ThemeCycleContext => {
      const stepSeconds = nextDuration(context.stepSeconds)
      if (context.status === 'idle') {
        return {...context, stepSeconds}
      }
      const step = stepAfter(visibleStep(selection) ?? context.step)
      enqueue.emit.stepped({step})
      return {...context, stepSeconds, step}
    },
  },
})
