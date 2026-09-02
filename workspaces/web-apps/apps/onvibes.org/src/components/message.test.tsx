import {cleanup, render, screen} from '@testing-library/react'
import {expect, test} from 'vitest'

import type {Message} from '@/lib/conversations'
import {MessageBubble} from './message'

function renderBubble(message: Message) {
  cleanup()
  render(<MessageBubble message={message} />)
  return screen.getByText(message.text).closest('[data-role]')
}

test('a user message is a bubble marked with its role and no mark', () => {
  const bubble = renderBubble({id: 'u', role: 'user', text: 'Make it purple'})

  expect(bubble?.getAttribute('data-role')).toBe('user')
  expect(bubble?.querySelector('svg')).toBeNull()
})

test('an assistant message carries a decorative mark and its role', () => {
  const bubble = renderBubble({id: 'a', role: 'assistant', text: 'Purple it is'})

  expect(bubble?.getAttribute('data-role')).toBe('assistant')
  expect(bubble?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})

test('the ref lands on the bubble element', () => {
  cleanup()
  const seen: Array<HTMLDivElement | null> = []
  render(
    <MessageBubble
      message={{id: 'u', role: 'user', text: 'Ref me'}}
      ref={(el) => {
        seen.push(el)
      }}
    />,
  )
  expect(seen[0]?.getAttribute('data-role')).toBe('user')
})
