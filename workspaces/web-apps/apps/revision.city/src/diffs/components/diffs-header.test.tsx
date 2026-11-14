import '@testing-library/jest-dom/vitest'
import type {ColorMode} from '@pierre/theming'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import {ThemeDropdown} from './diffs-header'
import {docsThemeCatalog} from './theme-catalog'

// The menu positions itself with Floating UI, which watches sizes with a
// ResizeObserver that jsdom does not provide.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, {ResizeObserver: StubResizeObserver})

// fireEvent sends only the key event. A browser clicks a focused button on
// Enter or Space when no handler cancels the key, so do the same here.
const pressKey = (element: HTMLElement, key: string) => {
  if (fireEvent.keyDown(element, {key})) fireEvent.click(element)
}

const ignoreThemeName = () => {}

const openThemeMenu = async () => {
  const setColorMode = vi.fn<(mode: ColorMode) => void>()
  const view = render(
    <ThemeDropdown
      colorMode="dark"
      darkThemeName={docsThemeCatalog.defaultDarkThemeName}
      lightThemeName={docsThemeCatalog.defaultLightThemeName}
      setColorMode={setColorMode}
      setDarkThemeName={ignoreThemeName}
      setLightThemeName={ignoreThemeName}
    />,
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'Theme settings'}))
  })
  return {setColorMode, unmount: view.unmount}
}

test.each([
  {keyName: 'Enter', key: 'Enter', label: 'Auto', mode: 'system'},
  {keyName: 'Enter', key: 'Enter', label: 'Light', mode: 'light'},
  {keyName: 'Space', key: ' ', label: 'Auto', mode: 'system'},
  {keyName: 'Space', key: ' ', label: 'Light', mode: 'light'},
])(
  'the $keyName key on $label picks the color mode and keeps the menu open',
  async ({key, label, mode}) => {
    const {setColorMode, unmount} = await openThemeMenu()
    const button = screen.getByRole('button', {name: label})
    button.focus()

    pressKey(button, key)

    expect(setColorMode).toHaveBeenCalledWith(mode)
    expect(screen.getByRole('menu')).toHaveAttribute('data-state', 'open')
    unmount()
  },
)
