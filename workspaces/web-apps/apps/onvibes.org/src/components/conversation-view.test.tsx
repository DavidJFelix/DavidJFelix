import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import {type Conversation, createConversation} from '@/lib/conversations'
import {ConversationView} from './conversation-view'

// jsdom has no layout, so it does not implement scrollIntoView; stubbing it
// here also lets the tests assert which bubble asks to be scrolled to.
const scrollIntoView = vi.fn<Element['scrollIntoView']>()
Element.prototype.scrollIntoView = scrollIntoView

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

function renderView(conversation: Conversation) {
  cleanup()
  const onSend = vi.fn<(text: string) => void>()
  const onOpenSidebar = vi.fn<() => void>()
  scrollIntoView.mockClear()
  render(
    <ConversationView conversation={conversation} onSend={onSend} onOpenSidebar={onOpenSidebar} />,
  )
  return {onSend, onOpenSidebar}
}

test('the conversation title is the page heading', () => {
  renderView(thread)
  expect(screen.getByRole('heading', {level: 1, name: 'Trail map'})).toBeDefined()
})

test('every message renders in order with its role', () => {
  renderView(thread)
  const main = screen.getByRole('main')
  const bubbles = [...main.querySelectorAll('[data-role]')]

  expect(bubbles.map((el) => el.getAttribute('data-role'))).toEqual(['user', 'assistant', 'user'])
  expect(bubbles.map((el) => el.textContent)).toEqual([
    'Map the canyons',
    'Fourteen pins, one card each',
    'Cluster them when zoomed out',
  ])
})

test('only the newest message is scrolled into view', () => {
  renderView(thread)

  expect(scrollIntoView).toHaveBeenCalledOnce()
  expect(scrollIntoView.mock.instances[0]).toHaveProperty(
    'textContent',
    'Cluster them when zoomed out',
  )
})

test('an empty conversation shows the empty state instead of a thread', () => {
  renderView(createConversation({id: 'fresh'}))

  expect(screen.getByText('What do you want to build?')).toBeDefined()
  expect(screen.getByRole('main').querySelector('[data-role]')).toBeNull()
  expect(scrollIntoView).not.toHaveBeenCalled()
})

test('the composer hands the sent text up', () => {
  const {onSend} = renderView(thread)

  fireEvent.change(screen.getByRole('textbox', {name: 'Message'}), {
    target: {value: 'Export as PDF?'},
  })
  fireEvent.click(screen.getByRole('button', {name: 'Send message'}))

  expect(onSend).toHaveBeenCalledExactlyOnceWith('Export as PDF?')
})

test('the header button opens the sidebar', () => {
  const {onOpenSidebar} = renderView(thread)

  fireEvent.click(screen.getByRole('button', {name: 'Open sidebar'}))

  expect(onOpenSidebar).toHaveBeenCalledOnce()
})
