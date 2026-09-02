import {expect, test, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {type Conversation, createConversation} from '@/lib/conversations'
import {ConversationView} from './conversation-view'

const thread: Conversation = {
  id: 'thread',
  title: 'Trail map',
  updatedMinutesAgo: 0,
  messages: [
    {id: 'm1', role: 'user', text: 'Map the canyons'},
    {id: 'm2', role: 'assistant', text: 'Fourteen pins, one card each'},
    {id: 'm3', role: 'user', text: 'Cluster them when zoomed out'},
  ],
}

// A thread tall enough to overflow the fixed-height frame below.
const longThread: Conversation = {
  ...thread,
  messages: Array.from({length: 30}, (_, i) => ({
    id: `long-${i}`,
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    text: `Message number ${i + 1}`,
  })),
}

const FRAME_HEIGHT = 320

async function renderView(conversation: Conversation) {
  const onSend = vi.fn<(text: string) => void>()
  const onOpenSidebar = vi.fn<() => void>()
  // The view fills its parent, so the frame gives it a real height to scroll in.
  const screen = await render(
    <div style={{height: FRAME_HEIGHT}}>
      <ConversationView conversation={conversation} onSend={onSend} onOpenSidebar={onOpenSidebar} />
    </div>,
  )
  const main = screen.getByRole('main')
  return {screen, main, onSend, onOpenSidebar}
}

test('the conversation title is the page heading', async () => {
  // given
  const {screen} = await renderView(thread)

  // then
  await expect.element(screen.getByRole('heading', {level: 1})).toHaveTextContent('Trail map')
})

test('every message renders in order with its role', async () => {
  // given
  const {main} = await renderView(thread)

  // when
  const bubbles = [...main.element().querySelectorAll('[data-role]')]

  // then
  expect(bubbles.map((el) => el.getAttribute('data-role'))).toEqual(['user', 'assistant', 'user'])
  expect(bubbles.map((el) => el.textContent)).toEqual([
    'Map the canyons',
    'Fourteen pins, one card each',
    'Cluster them when zoomed out',
  ])
})

test('the thread opens scrolled to the newest message', async () => {
  // given
  const {main, screen} = await renderView(longThread)
  const scroller = [...main.element().querySelectorAll('div')].find(
    (el) => getComputedStyle(el).overflowY === 'auto',
  )
  if (!scroller) throw new Error('scroll container not found')
  const newest = screen.getByText('Message number 30').element()

  // then
  await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
  const frame = scroller.getBoundingClientRect()
  const bubble = newest.getBoundingClientRect()
  expect(bubble.top).toBeGreaterThanOrEqual(frame.top)
  expect(bubble.bottom).toBeLessThanOrEqual(frame.bottom + 1)
})

test('an empty conversation shows the empty state instead of a thread', async () => {
  // given
  const {screen, main} = await renderView(createConversation({id: 'fresh'}))

  // then
  await expect.element(screen.getByText('What do you want to build?')).toBeVisible()
  expect(main.element().querySelector('[data-role]')).toBeNull()
})

test('the composer hands the sent text up', async () => {
  // given
  const {screen, onSend} = await renderView(thread)
  await screen.getByRole('textbox', {name: 'Message'}).fill('Export as PDF?')

  // when
  await screen.getByRole('button', {name: 'Send message'}).click()

  // then
  expect(onSend).toHaveBeenCalledExactlyOnceWith('Export as PDF?')
})

test('the header button opens the sidebar', async () => {
  // given
  const {screen, onOpenSidebar} = await renderView(thread)

  // when
  await screen.getByRole('button', {name: 'Open sidebar'}).click()

  // then
  expect(onOpenSidebar).toHaveBeenCalledOnce()
})
