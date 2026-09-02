import {expect, test} from 'vitest'

import {
  appendMessage,
  type Conversation,
  createConversation,
  formatRelativeTime,
  NEW_CONVERSATION_TITLE,
  previewOf,
  replaceConversation,
  SEED_CONVERSATIONS,
  titleFrom,
} from './conversations'

test.each([
  ['under a minute', 0.5, 'now'],
  ['whole minutes', 12, '12m'],
  ['fractional minutes floor', 59.9, '59m'],
  ['exactly an hour', 60, '1h'],
  ['hours floor', 3 * 60 + 59, '3h'],
  ['exactly a day', 24 * 60, '1d'],
  ['many days', 6 * 24 * 60 + 30, '6d'],
])('formatRelativeTime: %s', (_name, minutesAgo, expected) => {
  // when
  const label = formatRelativeTime({minutesAgo})

  // then
  expect(label).toBe(expected)
})

test('previewOf collapses the last message to one line', () => {
  // given
  const conversation: Conversation = {
    id: 'c',
    title: 'c',
    updatedMinutesAgo: 0,
    messages: [
      {id: '1', role: 'user', text: 'first'},
      {id: '2', role: 'assistant', text: '  spans\nseveral\t lines  '},
    ],
  }

  // when
  const preview = previewOf(conversation)

  // then
  expect(preview).toBe('spans several lines')
})

test('previewOf names the empty case', () => {
  // given
  const conversation = createConversation({id: 'c'})

  // when
  const preview = previewOf(conversation)

  // then
  expect(preview).toBe('No messages yet')
})

test.each([
  ['short text is kept whole', 'Build a timer', 'Build a timer'],
  ['whitespace is collapsed', '  Build\n a   timer ', 'Build a timer'],
  [
    'long text is cut at a word boundary',
    'Split a restaurant bill by who ordered what, with tax and tip',
    'Split a restaurant bill by who ordered…',
  ],
  ['a single long word is cut hard', 'a'.repeat(50), `${'a'.repeat(40)}…`],
])('titleFrom: %s', (_name, text, expected) => {
  // when
  const title = titleFrom(text)

  // then
  expect(title).toBe(expected)
})

test('createConversation starts untitled and empty', () => {
  // when
  const conversation = createConversation({id: 'fresh'})

  // then
  expect(conversation).toEqual({
    id: 'fresh',
    title: NEW_CONVERSATION_TITLE,
    updatedMinutesAgo: 0,
    messages: [],
  })
})

test('appendMessage titles an untitled conversation from its first message', () => {
  // given
  const conversation = createConversation({id: 'fresh'})
  const message = {id: 'm1', role: 'user' as const, text: 'Make me a habit tracker'}

  // when
  const next = appendMessage({conversation, message})

  // then
  expect(next.title).toBe('Make me a habit tracker')
  expect(next.messages).toEqual([message])
  expect(conversation.messages).toEqual([])
})

test('appendMessage keeps an existing title and resets the age', () => {
  // given
  const conversation = {...SEED_CONVERSATIONS[0], updatedMinutesAgo: 90}
  const message = {id: 'm2', role: 'user' as const, text: 'One more thing'}

  // when
  const next = appendMessage({conversation, message})

  // then
  expect(next.title).toBe(conversation.title)
  expect(next.updatedMinutesAgo).toBe(0)
  expect(next.messages.at(-1)).toEqual(message)
  expect(next.messages).toHaveLength(conversation.messages.length + 1)
})

test('replaceConversation swaps by id and keeps order', () => {
  // given
  const updated = {...SEED_CONVERSATIONS[1], title: 'Renamed'}

  // when
  const next = replaceConversation({conversations: SEED_CONVERSATIONS, conversation: updated})

  // then
  expect(next.map((c) => c.id)).toEqual(SEED_CONVERSATIONS.map((c) => c.id))
  expect(next[1]).toBe(updated)
  expect(next[0]).toBe(SEED_CONVERSATIONS[0])
})

test('seed conversations have unique ids and unique message ids', () => {
  // given
  const ids = SEED_CONVERSATIONS.map((c) => c.id)
  const messageIds = SEED_CONVERSATIONS.flatMap((c) => c.messages.map((m) => m.id))

  // then
  expect(new Set(ids).size).toBe(ids.length)
  expect(new Set(messageIds).size).toBe(messageIds.length)
})
