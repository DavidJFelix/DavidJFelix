import type {CodeViewHandle} from '@pierre/diffs/react'
import type {ThemeLike} from '@pierre/theming'
import {act, createRef} from 'react'
import type {CSSProperties} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {expect, test} from 'vitest'

import {ThemedCodeView} from './ThemedCodeView'
import {ThemedSurface} from './ThemedSurface'
import {ThemeSourceProvider} from './ThemeSourceProvider'
import type {ChromeMapping} from '@/diffs/lib/theme/chrome-theme-props'

// jsdom (the vitest environment configured for this app) does not implement
// ResizeObserver; stub it so a mounted CodeView/surface that observes its
// container doesn't throw. Module-level rather than a hook: document/window
// already exist under the jsdom environment, this just fills the one gap.
class MockResizeObserver {
  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
}
Object.assign(globalThis, {ResizeObserver: MockResizeObserver})

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

const lightTheme: ThemeLike = {
  name: 'light-theme',
  type: 'light',
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#111111',
    'sideBar.background': '#ffffff',
    'sideBar.foreground': '#111111',
  },
}

const darkTheme: ThemeLike = {
  name: 'dark-theme',
  type: 'dark',
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#eeeeee',
    'sideBar.background': '#000000',
    'sideBar.foreground': '#eeeeee',
  },
}

const themeNameMapping: ChromeMapping = (_chrome, theme) =>
  ({
    '--test-theme-name': theme.name ?? '',
  }) as CSSProperties

// Flushes the microtasks React schedules for effects/state updates so
// assertions can read the settled DOM.
async function flushReact(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

test('React themed component overrides: ThemedCodeView preserves caller themeType while applying the active theme pair', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const codeViewRef = createRef<CodeViewHandle<undefined>>()
  let root: Root | undefined

  await act(async () => {
    root = createRoot(container)
    root.render(
      <ThemedCodeView
        ref={codeViewRef}
        disableWorkerPool
        options={{
          theme: {light: 'old-light', dark: 'old-dark'},
          themeType: 'system',
        }}
        theme={{light: 'next-light', dark: 'next-dark'}}
      />,
    )
    await flushReact()
  })

  const instance = codeViewRef.current?.getInstance() as
    | {
        options: {
          theme: {light: string; dark: string}
          themeType: string
        }
      }
    | undefined
  expect(instance?.options.theme).toEqual({
    light: 'next-light',
    dark: 'next-dark',
  })
  expect(instance?.options.themeType).toBe('system')

  await act(async () => {
    root?.unmount()
    await flushReact()
  })
  container.remove()
})

test('React themed component overrides: per-component theme pairs use the provider color scheme', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  let root: Root | undefined
  await act(async () => {
    root = createRoot(container)
    root.render(
      <ThemeSourceProvider theme={darkTheme}>
        <ThemedSurface mapping={themeNameMapping} theme={{light: lightTheme, dark: darkTheme}} />
      </ThemeSourceProvider>,
    )
    await flushReact()
  })

  const surface = container.firstElementChild as HTMLElement
  expect(surface.style.getPropertyValue('--test-theme-name')).toBe('dark-theme')

  await act(async () => {
    root?.unmount()
    await flushReact()
  })
  container.remove()
})
