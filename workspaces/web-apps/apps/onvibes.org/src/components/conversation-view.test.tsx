import {expect, test, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {type Conversation, createConversation} from '@/lib/conversations'
import {ConversationView} from './conversation-view'

const thread: Conversation = {
  id: 'thread',
  title: 'Trail map',
  updatedAt: 0,
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

interface RenderViewOptions {
  busy?: boolean
  error?: string
}

async function renderView(conversation: Conversation, {busy, error}: RenderViewOptions = {}) {
  const onSend = vi.fn<(text: string) => void>()
  const onStop = vi.fn<() => void>()
  const onRetry = vi.fn<() => void>()
  const onOpenSidebar = vi.fn<() => void>()
  // The view fills its parent, so the frame gives it a real height to scroll in.
  const view = (thread: Conversation) => (
    <div style={{height: FRAME_HEIGHT}}>
      <ConversationView
        conversation={thread}
        busy={busy}
        error={error}
        onSend={onSend}
        onStop={onStop}
        onRetry={onRetry}
        onOpenSidebar={onOpenSidebar}
      />
    </div>
  )
  const screen = await render(view(conversation))
  const main = screen.getByRole('main')
  const rerender = (thread: Conversation) => screen.rerender(view(thread))
  return {screen, main, rerender, onSend, onStop, onRetry, onOpenSidebar}
}

function scrollerOf(main: Element): HTMLElement {
  const scroller = [...main.querySelectorAll('div')].find(
    (el) => getComputedStyle(el).overflowY === 'auto',
  )
  if (!scroller) throw new Error('scroll container not found')
  return scroller
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
  const scroller = scrollerOf(main.element())
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
  const {screen, main} = await renderView(createConversation({id: 'fresh', now: 0}))

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

test('while a reply is awaited a placeholder holds its place and the composer offers stop', async () => {
  // given
  const {screen, main, onStop} = await renderView(thread, {busy: true})
  const placeholder = screen.getByRole('status', {name: 'Waiting for a reply'})
  await expect.element(placeholder).toBeVisible()
  expect(main.element().querySelectorAll('[data-role]')).toHaveLength(3)

  // when
  await screen.getByRole('button', {name: 'Stop generating'}).click()

  // then
  expect(onStop).toHaveBeenCalledOnce()
})

test('once the reply starts arriving the placeholder gives way to the bubble', async () => {
  // given
  const streaming: Conversation = {
    ...thread,
    messages: [...thread.messages, {id: 'm4', role: 'assistant', text: 'Yes. Pins within'}],
  }

  // when
  const {screen, main} = await renderView(streaming, {busy: true})

  // then
  await expect.element(main.getByText('Yes. Pins within')).toBeVisible()
  expect(screen.container.querySelector('output')).toBeNull()
})

test('the thread follows a reply as it streams', async () => {
  // given
  const streaming: Conversation = {...longThread, messages: [...longThread.messages]}
  const {main, rerender} = await renderView(streaming, {busy: true})
  const scroller = scrollerOf(main.element())
  const before = scroller.scrollTop

  // when: the last bubble grows in place instead of a new one mounting
  const grown = {
    ...streaming,
    messages: [
      ...streaming.messages.slice(0, -1),
      {id: 'long-29', role: 'assistant' as const, text: Array(12).fill('More words.').join('\n')},
    ],
  }
  await rerender(grown)

  // then
  await expect.poll(() => scroller.scrollTop).toBeGreaterThan(before)
  const bubble = main
    .getByText(/More words\./u)
    .element()
    .getBoundingClientRect()
  expect(bubble.bottom).toBeLessThanOrEqual(scroller.getBoundingClientRect().bottom + 1)
})

test('a failed reply says so and offers to try again', async () => {
  // given
  const {screen, onRetry} = await renderView(thread, {
    error: 'Chat is not set up on this server yet.',
  })
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Chat is not set up on this server yet.')

  // when
  await screen.getByRole('button', {name: 'Try again'}).click()

  // then
  expect(onRetry).toHaveBeenCalledOnce()
})
