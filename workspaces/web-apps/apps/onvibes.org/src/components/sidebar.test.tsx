import {expect, test, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import type {Conversation} from '@/lib/conversations'
import {Sidebar} from './sidebar'

const MINUTE = 60_000
const minutesAgo = (minutes: number) => Date.now() - minutes * MINUTE

const conversations: ReadonlyArray<Conversation> = [
  {
    id: 'alpha',
    title: 'Alpha',
    updatedAt: minutesAgo(12),
    messages: [{id: 'a1', role: 'assistant', text: 'Last word on alpha'}],
  },
  {id: 'beta', title: 'Beta', updatedAt: minutesAgo(3 * 60), messages: []},
]

interface RenderSidebarOptions {
  activeId?: string | null
}

async function renderSidebar({activeId = 'alpha'}: RenderSidebarOptions = {}) {
  const onSelect = vi.fn<(id: string) => void>()
  const onNew = vi.fn<() => void>()
  const onClose = vi.fn<() => void>()
  const screen = await render(
    <Sidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={onSelect}
      onNew={onNew}
      onClose={onClose}
    />,
  )
  const nav = screen.getByRole('navigation', {name: 'Conversations'})
  return {screen, onSelect, onNew, onClose, nav}
}

test('each conversation is a row with its title, preview, and age', async () => {
  // given
  const {nav} = await renderSidebar()

  // when
  const rows = nav.getByRole('button').all()

  // then
  expect(rows).toHaveLength(2)
  await expect.element(rows[0]).toHaveTextContent('Alpha12mLast word on alpha')
  await expect.element(rows[1]).toHaveTextContent('Beta3hNo messages yet')
})

test('only the active conversation carries aria-current', async () => {
  // given
  const {nav} = await renderSidebar({activeId: 'beta'})

  // then
  await expect
    .element(nav.getByRole('button', {name: /Alpha/u}))
    .not.toHaveAttribute('aria-current')
  await expect
    .element(nav.getByRole('button', {name: /Beta/u}))
    .toHaveAttribute('aria-current', 'true')
})

test('no row is current when nothing is selected', async () => {
  // given
  const {nav} = await renderSidebar({activeId: null})

  // when
  const current = nav
    .getByRole('button')
    .elements()
    .filter((row) => row.hasAttribute('aria-current'))

  // then
  expect(current).toHaveLength(0)
})

test('clicking a row selects that conversation by id', async () => {
  // given
  const {onSelect, nav} = await renderSidebar()

  // when
  await nav.getByRole('button', {name: /Beta/u}).click()

  // then
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('beta')
})

test('the header actions start a new conversation and close the drawer', async () => {
  // given
  const {screen, onNew, onClose} = await renderSidebar()

  // when
  await screen.getByRole('button', {name: 'New conversation'}).click()
  await screen.getByRole('button', {name: 'Close sidebar'}).click()

  // then
  expect(onNew).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
})

test('a long title truncates inside the row instead of overflowing it', async () => {
  // given
  const long: Conversation = {
    id: 'long',
    title: 'A title long enough that it cannot possibly fit inside the sidebar row',
    updatedAt: minutesAgo(1),
    messages: [],
  }
  const screen = await render(
    <div style={{width: 288}}>
      <Sidebar
        conversations={[long]}
        activeId={null}
        onSelect={() => {}}
        onNew={() => {}}
        onClose={() => {}}
      />
    </div>,
  )

  // when
  const row = screen.getByRole('button', {name: /A title long enough/u}).element()
  const title = row.querySelector('span')

  // then
  expect(title?.scrollWidth).toBeGreaterThan(title?.clientWidth ?? 0)
  expect(row.scrollWidth).toBe(row.clientWidth)
})
