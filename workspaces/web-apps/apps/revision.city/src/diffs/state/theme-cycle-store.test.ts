import {expect, test} from 'vitest'

import {docsThemeCatalog} from '@/diffs/components/theme-catalog'

import {type ThemeCycleStep, type ThemeSelection, themeCycleLogic} from './theme-cycle-store'

const lightThemes = docsThemeCatalog.getThemeNames({colorScheme: 'light'})
const darkThemes = docsThemeCatalog.getThemeNames({colorScheme: 'dark'})

function selection(overrides: Partial<ThemeSelection> = {}): ThemeSelection {
  return {
    lightThemeName: lightThemes[0],
    darkThemeName: darkThemes[0],
    resolvedThemeMode: 'light',
    ...overrides,
  }
}

function createCycleStore() {
  const store = themeCycleLogic.createStore()
  const steps: ThemeCycleStep[] = []
  store.on('stepped', ({step}) => {
    steps.push(step)
  })
  return {store, steps}
}

test.each([
  {
    name: 'the light theme after the visible one',
    from: selection({lightThemeName: lightThemes[1]}),
    step: {mode: 'light', theme: lightThemes[2]},
  },
  {
    name: 'the dark theme after the visible one',
    from: selection({darkThemeName: darkThemes[1], resolvedThemeMode: 'dark'}),
    step: {mode: 'dark', theme: darkThemes[2]},
  },
  {
    name: 'the first dark theme after the last light theme',
    from: selection({lightThemeName: lightThemes[lightThemes.length - 1]}),
    step: {mode: 'dark', theme: darkThemes[0]},
  },
  {
    name: 'the first light theme after the last dark theme',
    from: selection({darkThemeName: darkThemes[darkThemes.length - 1], resolvedThemeMode: 'dark'}),
    step: {mode: 'light', theme: lightThemes[0]},
  },
])('a toggle starts the sweep on $name', ({from, step}) => {
  const {store, steps} = createCycleStore()

  store.trigger.toggled(from)

  expect(steps).toEqual([step])
  expect(store.getSnapshot().context).toEqual({status: 'cycling', stepSeconds: 3, step})
})

test('a toggle before the theme selection is hydrated does not start the sweep', () => {
  const {store} = createCycleStore()

  expect(store.can.toggled(selection({resolvedThemeMode: undefined}))).toBe(false)
})

test('each tick shows the next theme', () => {
  const {store, steps} = createCycleStore()
  store.trigger.toggled(selection())

  store.trigger.ticked()
  store.trigger.ticked()

  expect(steps).toEqual([
    {mode: 'light', theme: lightThemes[1]},
    {mode: 'light', theme: lightThemes[2]},
    {mode: 'light', theme: lightThemes[3]},
  ])
})

test('a toggle stops the sweep, and a tick after the stop changes nothing', () => {
  const {store, steps} = createCycleStore()
  store.trigger.toggled(selection())

  store.trigger.toggled(selection())

  expect(store.getSnapshot().context).toEqual({status: 'idle', stepSeconds: 3})
  expect(store.can.ticked()).toBe(false)
  expect(steps).toHaveLength(1)
})

test('a duration bump steps through the durations and back to the first', () => {
  const {store, steps} = createCycleStore()
  const durations: number[] = []

  for (let bump = 0; bump < 4; bump++) {
    store.trigger.durationBumped(selection())
    durations.push(store.getSnapshot().context.stepSeconds)
  }

  expect(durations).toEqual([0.8, 0.4, 0.1, 3])
  expect(steps).toEqual([])
})

test('a duration bump during the sweep shows the theme after the visible one', () => {
  const {store, steps} = createCycleStore()
  store.trigger.toggled(selection())

  store.trigger.durationBumped(selection({lightThemeName: lightThemes[5]}))

  expect(steps.at(-1)).toEqual({mode: 'light', theme: lightThemes[6]})
  expect(store.getSnapshot().context).toMatchObject({status: 'cycling', stepSeconds: 0.8})
})

test('a duration bump during the sweep without a hydrated selection continues the sweep', () => {
  const {store, steps} = createCycleStore()
  store.trigger.toggled(selection())

  store.trigger.durationBumped(selection({resolvedThemeMode: undefined}))

  expect(steps.at(-1)).toEqual({mode: 'light', theme: lightThemes[2]})
})
