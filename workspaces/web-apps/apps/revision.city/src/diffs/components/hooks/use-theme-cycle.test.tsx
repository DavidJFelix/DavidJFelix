import {act, cleanup, renderHook} from '@testing-library/react'
import {expect, onTestFinished, test, vi} from 'vitest'

import {docsThemeCatalog} from '@/diffs/components/theme-catalog'

import {useThemeCycle} from './use-theme-cycle'

const lightThemes = docsThemeCatalog.getThemeNames({colorScheme: 'light'})
const darkThemes = docsThemeCatalog.getThemeNames({colorScheme: 'dark'})

function mount() {
  vi.useFakeTimers()
  const setLightThemeName = vi.fn<(theme: string) => void>()
  const setColorMode = vi.fn<(mode: string) => void>()
  const hook = renderHook(
    ({lightThemeName}) =>
      useThemeCycle({
        lightThemeName,
        darkThemeName: darkThemes[0],
        resolvedThemeMode: 'light',
        setLightThemeName,
        setDarkThemeName: vi.fn<(theme: string) => void>(),
        setColorMode,
      }),
    {initialProps: {lightThemeName: lightThemes[0]}},
  )
  onTestFinished(() => {
    cleanup()
    vi.useRealTimers()
  })
  return {hook, setColorMode, setLightThemeName}
}

test('a toggle shows the next theme at once, then one more theme each step', () => {
  const {hook, setColorMode, setLightThemeName} = mount()

  act(() => {
    hook.result.current.toggleCycle()
  })
  act(() => {
    vi.advanceTimersByTime(3000)
  })

  expect(hook.result.current.cycling).toBe(true)
  expect(setLightThemeName.mock.calls).toEqual([[lightThemes[1]], [lightThemes[2]]])
  expect(setColorMode).toHaveBeenLastCalledWith('light')
})

test('a stop ends the steps', () => {
  const {hook, setLightThemeName} = mount()
  act(() => {
    hook.result.current.toggleCycle()
  })

  act(() => {
    hook.result.current.toggleCycle()
  })
  act(() => {
    vi.advanceTimersByTime(10_000)
  })

  expect(hook.result.current.cycling).toBe(false)
  expect(setLightThemeName).toHaveBeenCalledOnce()
})

test('the controls keep their identity when the theme changes', () => {
  const {hook} = mount()
  const controls = hook.result.current

  hook.rerender({lightThemeName: lightThemes[4]})

  expect(hook.result.current).toBe(controls)
})

test('a toggle reads the theme of the latest render', () => {
  const {hook, setLightThemeName} = mount()
  hook.rerender({lightThemeName: lightThemes[4]})

  act(() => {
    hook.result.current.toggleCycle()
  })

  expect(setLightThemeName).toHaveBeenCalledWith(lightThemes[5])
})
