import {expect, test, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'
import {render} from 'vitest-browser-react'

import {AppShell} from './app-shell'

// Below Panda's `md` breakpoint (48rem) the sidebar is an off-canvas drawer;
// above it, a fixed column. The two viewports pin each layout.
const SMALL = {width: 390, height: 844}
const WIDE = {width: 1024, height: 768}

interface RenderShellParams {
  sidebarOpen: boolean
  viewport: {width: number; height: number}
}

async function renderShell({sidebarOpen, viewport}: RenderShellParams) {
  await page.viewport(viewport.width, viewport.height)
  const onSidebarClose = vi.fn<() => void>()
  const screen = await render(
    <AppShell sidebar={<p>sidebar</p>} sidebarOpen={sidebarOpen} onSidebarClose={onSidebarClose}>
      <p>main</p>
    </AppShell>,
  )
  return {screen, onSidebarClose, aside: screen.getByRole('complementary')}
}

test('the sidebar and main content render side by side on a wide viewport', async () => {
  // given
  const {screen, aside} = await renderShell({sidebarOpen: false, viewport: WIDE})

  // then
  await expect.element(aside).toBeInViewport()
  await expect.element(screen.getByText('main')).toBeInViewport()
  expect(aside.element().getBoundingClientRect().right).toBeLessThanOrEqual(
    screen.getByText('main').element().getBoundingClientRect().left,
  )
})

test('the closed drawer sits off-canvas on a small viewport', async () => {
  // given
  const {aside} = await renderShell({sidebarOpen: false, viewport: SMALL})

  // then
  await expect.element(aside).not.toBeInViewport()
})

test('the open drawer covers the main view on a small viewport', async () => {
  // given
  const {aside} = await renderShell({sidebarOpen: true, viewport: SMALL})

  // then
  await expect.element(aside).toBeInViewport()
  await expect.element(aside).toHaveAttribute('data-open', 'true')
})

test('the scrim exists only while the drawer is open', async () => {
  // given
  const {screen} = await renderShell({sidebarOpen: false, viewport: SMALL})

  // then
  expect(screen.getByRole('button', {name: 'Close sidebar'}).query()).toBeNull()
})

test('clicking the scrim beside the drawer closes it', async () => {
  // given
  const {screen, onSidebarClose} = await renderShell({sidebarOpen: true, viewport: SMALL})

  // when: the drawer covers the left 288px, so the click lands to its right
  await screen.getByRole('button', {name: 'Close sidebar'}).click({position: {x: 350, y: 400}})

  // then
  expect(onSidebarClose).toHaveBeenCalledOnce()
})

test('Escape closes an open drawer', async () => {
  // given
  const {onSidebarClose} = await renderShell({sidebarOpen: true, viewport: SMALL})

  // when
  await userEvent.keyboard('{Escape}')

  // then
  expect(onSidebarClose).toHaveBeenCalledOnce()
})

test('Escape is ignored while the drawer is closed', async () => {
  // given
  const {onSidebarClose} = await renderShell({sidebarOpen: false, viewport: SMALL})

  // when
  await userEvent.keyboard('{Escape}')

  // then
  expect(onSidebarClose).not.toHaveBeenCalled()
})
