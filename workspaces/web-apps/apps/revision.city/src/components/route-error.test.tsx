import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test, vi} from 'vitest'
import {RouteError} from './route-error'

const invalidate = vi.fn<() => Promise<void>>(() => Promise.resolve())

vi.mock('@pierre/icons', () => ({IconCiWarningFill: () => null}))
vi.mock('@tanstack/react-router', () => ({useRouter: () => ({invalidate})}))

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

const ERROR_TEXT = ['secret', 'stack', 'detail'].join(' ')

function renderPanel(reset: () => void): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<RouteError error={new Error(ERROR_TEXT)} reset={reset} />)
  })
  return container
}

test('route error panel shows a calm message and no error text', () => {
  const panel = renderPanel(vi.fn<() => void>())

  expect(panel.querySelector('[role="alert"]')?.textContent).toContain('Couldn’t show this page')
  expect(panel.textContent).not.toContain(ERROR_TEXT)
})

test('route error panel resets the boundary and reloads the route on try again', () => {
  const reset = vi.fn<() => void>()
  const button = renderPanel(reset).querySelector('button')

  act(() => {
    button?.click()
  })

  expect(reset).toHaveBeenCalledOnce()
  expect(invalidate).toHaveBeenCalledOnce()
})
