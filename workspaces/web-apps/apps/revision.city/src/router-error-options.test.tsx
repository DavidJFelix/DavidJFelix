// @vitest-environment jsdom
// cSpell:ignore unstub -- vi.unstubAllGlobals
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test, vi} from 'vitest'
import {routerErrorOptions} from './router-error-options'

vi.mock('@pierre/icons', () => ({IconCiWarningFill: () => null}))

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

function ThrowingPage(): never {
  throw new Error('render failed')
}

test('a render error shows the app panel and is reported once', async () => {
  // jsdom has no reportError.
  const reportError = vi.fn<(error: unknown) => void>()
  vi.stubGlobal('reportError', reportError)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const rootRoute = createRootRoute()
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: ThrowingPage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory(),
    ...routerErrorOptions,
  })
  const container = document.createElement('div')
  document.body.appendChild(container)

  await act(async () => {
    createRoot(container).render(<RouterProvider router={router} />)
  })

  expect(container.textContent).toContain('Couldn’t show this page')
  expect(reportError).toHaveBeenCalledOnce()
  expect(reportError).toHaveBeenCalledWith(expect.objectContaining({message: 'render failed'}))
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
