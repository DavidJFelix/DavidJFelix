import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import {AppShell} from './app-shell'

function renderShell(sidebarOpen: boolean) {
  cleanup()
  const onSidebarClose = vi.fn<() => void>()
  render(
    <AppShell sidebar={<p>sidebar</p>} sidebarOpen={sidebarOpen} onSidebarClose={onSidebarClose}>
      <p>main</p>
    </AppShell>,
  )
  return {onSidebarClose}
}

test('renders the sidebar and main content in an aside and a sibling', () => {
  renderShell(false)
  expect(screen.getByRole('complementary').textContent).toBe('sidebar')
  expect(screen.getByText('main')).toBeDefined()
})

test('the aside reflects the open state for the drawer styles', () => {
  renderShell(true)
  expect(screen.getByRole('complementary').getAttribute('data-open')).toBe('true')
})

test('the scrim exists only while the drawer is open and closes it on click', () => {
  const closed = renderShell(false)
  expect(screen.queryByRole('button', {name: 'Close sidebar'})).toBeNull()
  expect(closed.onSidebarClose).not.toHaveBeenCalled()
})

test('clicking the scrim closes the drawer', () => {
  const {onSidebarClose} = renderShell(true)

  fireEvent.click(screen.getByRole('button', {name: 'Close sidebar'}))

  expect(onSidebarClose).toHaveBeenCalledOnce()
})

test('Escape closes an open drawer', () => {
  const {onSidebarClose} = renderShell(true)

  fireEvent.keyDown(window, {key: 'Escape'})

  expect(onSidebarClose).toHaveBeenCalledOnce()
})

test('Escape is ignored while the drawer is closed', () => {
  const {onSidebarClose} = renderShell(false)

  fireEvent.keyDown(window, {key: 'Escape'})

  expect(onSidebarClose).not.toHaveBeenCalled()
})
