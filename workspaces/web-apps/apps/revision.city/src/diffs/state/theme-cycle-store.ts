import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {docsThemeCatalog} from '@/diffs/components/theme-catalog'
import type {DarkThemeName, LightThemeName} from '@/diffs/lib/theme-names'

export const THEME_CYCLE_DURATIONS_SECONDS = [3, 0.8, 0.4, 0.1] as const

const lightThemeNameSchema = z.custom<LightThemeName>()

const darkThemeNameSchema = z.custom<DarkThemeName>()

const themeCycleDurationSecondsSchema = z.literal(THEME_CYCLE_DURATIONS_SECONDS)

const themeCycleStepSchema = z.readonly(
  z.discriminatedUnion('mode', [
    z.object({mode: z.literal('light'), theme: lightThemeNameSchema}),
    z.object({mode: z.literal('dark'), theme: darkThemeNameSchema}),
  ]),
)

const themeSelectionSchema = z.readonly(
  z.object({
    lightThemeName: lightThemeNameSchema,
    darkThemeName: darkThemeNameSchema,
    // Undefined until the theme selection is hydrated. The sweep cannot start
    // before then, because it starts from the visible mode.
    resolvedThemeMode: z.union([z.enum(['light', 'dark']), z.undefined()]),
  }),
)

const themeCycleContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({status: z.literal('idle'), stepSeconds: themeCycleDurationSecondsSchema}),
    z.object({
      status: z.literal('cycling'),
      stepSeconds: themeCycleDurationSecondsSchema,
      step: themeCycleStepSchema,
    }),
  ]),
)

const themeCycleEventSchemas = {
  toggled: themeSelectionSchema,
  ticked: z.object({}),
  durationBumped: themeSelectionSchema,
}

const themeCycleEmittedSchemas = {
  stepped: z.object({step: themeCycleStepSchema}),
}

export type ThemeCycleDurationSeconds = z.infer<typeof themeCycleDurationSecondsSchema>

export type ThemeCycleStep = z.infer<typeof themeCycleStepSchema>

export type ThemeSelection = z.infer<typeof themeSelectionSchema>

export type ThemeCycleContext = z.infer<typeof themeCycleContextSchema>

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
  schemas: {
    context: themeCycleContextSchema,
    events: themeCycleEventSchemas,
    emitted: themeCycleEmittedSchemas,
  },
  context: (): ThemeCycleContext => ({
    status: 'idle',
    stepSeconds: THEME_CYCLE_DURATIONS_SECONDS[0],
  }),
  on: {
    toggled: (context, selection, enqueue): ThemeCycleContext | undefined => {
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
    durationBumped: (context, selection, enqueue): ThemeCycleContext => {
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
