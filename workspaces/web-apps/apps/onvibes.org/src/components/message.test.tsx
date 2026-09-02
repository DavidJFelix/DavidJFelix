import {expect, test} from 'vitest'
import {render} from 'vitest-browser-react'

import type {Message} from '@/lib/conversations'
import {MessageBubble} from './message'

async function renderBubble(message: Message) {
  const screen = await render(<MessageBubble message={message} />)
  const bubble = screen.getByText(message.text).element().closest('[data-role]')
  if (!bubble) throw new Error('bubble not found')
  return bubble
}

test('a user message is a bubble marked with its role and no mark', async () => {
  // given
  const bubble = await renderBubble({id: 'u', role: 'user', text: 'Make it purple'})

  // then
  expect(bubble.getAttribute('data-role')).toBe('user')
  expect(bubble.querySelector('svg')).toBeNull()
})

test('an assistant message carries a decorative mark and its role', async () => {
  // given
  const bubble = await renderBubble({id: 'a', role: 'assistant', text: 'Purple it is'})

  // then
  expect(bubble.getAttribute('data-role')).toBe('assistant')
  expect(bubble.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})

test('the two voices sit on opposite edges of the column', async () => {
  // given
  const screen = await render(
    <div style={{display: 'flex', flexDirection: 'column', width: 600}}>
      <MessageBubble message={{id: 'u', role: 'user', text: 'Make it purple'}} />
      <MessageBubble message={{id: 'a', role: 'assistant', text: 'Purple it is'}} />
    </div>,
  )
  const column = screen.container.firstElementChild
  if (!column) throw new Error('column not found')

  // when
  const user = screen.getByText('Make it purple').element().closest('[data-role]')
  const assistant = screen.getByText('Purple it is').element().closest('[data-role]')
  if (!user || !assistant) throw new Error('bubbles not found')
  const frame = column.getBoundingClientRect()

  // then
  expect(user.getBoundingClientRect().right).toBeCloseTo(frame.right, 0)
  expect(assistant.getBoundingClientRect().left).toBeCloseTo(frame.left, 0)
})

test('the ref lands on the bubble element', async () => {
  // given
  const seen: Array<HTMLDivElement | null> = []
  const ref = (el: HTMLDivElement | null) => {
    seen.push(el)
  }

  // when
  await render(<MessageBubble message={{id: 'u', role: 'user', text: 'Ref me'}} ref={ref} />)

  // then
  expect(seen[0]?.getAttribute('data-role')).toBe('user')
})
