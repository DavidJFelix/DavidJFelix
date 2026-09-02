import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import type {Conversation} from '@/lib/conversations'
import {Sidebar} from './sidebar'

const conversations: ReadonlyArray<Conversation> = [
  {
    id: 'alpha',
    title: 'Alpha',
    updatedMinutesAgo: 12,
    messages: [{id: 'a1', role: 'assistant', text: 'Last word on alpha'}],
  },
  {id: 'beta', title: 'Beta', updatedMinutesAgo: 3 * 60, messages: []},
]

interface RenderSidebarOptions {
  activeId?: string | null
}

function renderSidebar({activeId = 'alpha'}: RenderSidebarOptions = {}) {
  cleanup()
  const onSelect = vi.fn<(id: string) => void>()
  const onNew = vi.fn<() => void>()
  const onClose = vi.fn<() => void>()
  render(
    <Sidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={onSelect}
      onNew={onNew}
      onClose={onClose}
    />,
  )
  const nav = screen.getByRole('navigation', {name: 'Conversations'})
  return {onSelect, onNew, onClose, nav}
}

test('each conversation is a row with its title, preview, and age', () => {
  const {nav} = renderSidebar()
  const rows = within(nav).getAllByRole('button')

  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveProperty('textContent', 'Alpha12mLast word on alpha')
  expect(rows[1]).toHaveProperty('textContent', 'Beta3hNo messages yet')
})

test('only the active conversation carries aria-current', () => {
  const {nav} = renderSidebar({activeId: 'beta'})

  expect(within(nav).getByRole('button', {name: /Alpha/u}).getAttribute('aria-current')).toBeNull()
  expect(within(nav).getByRole('button', {name: /Beta/u}).getAttribute('aria-current')).toBe('true')
})

test('no row is current when nothing is selected', () => {
  const {nav} = renderSidebar({activeId: null})
  const current = within(nav)
    .getAllByRole('button')
    .filter((row) => row.hasAttribute('aria-current'))
  expect(current).toHaveLength(0)
})

test('clicking a row selects that conversation by id', () => {
  const {onSelect, nav} = renderSidebar()

  fireEvent.click(within(nav).getByRole('button', {name: /Beta/u}))

  expect(onSelect).toHaveBeenCalledExactlyOnceWith('beta')
})

test('the header actions start a new conversation and close the drawer', () => {
  const {onNew, onClose} = renderSidebar()

  fireEvent.click(screen.getByRole('button', {name: 'New conversation'}))
  fireEvent.click(screen.getByRole('button', {name: 'Close sidebar'}))

  expect(onNew).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
})
