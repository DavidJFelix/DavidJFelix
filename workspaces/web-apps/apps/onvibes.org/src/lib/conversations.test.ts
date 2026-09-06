import type {UIMessage} from '@tanstack/ai-react'
import {expect, test} from 'vitest'

import {
  type Conversation,
  createConversation,
  formatRelativeTime,
  messagesFromUI,
  messageToUI,
  NEW_CONVERSATION_TITLE,
  previewOf,
  replaceConversation,
  titleFrom,
  withMessages,
} from './conversations'

const NOW = 1_700_000_000_000
const MINUTE = 60_000

const thread: Conversation = {
  id: 'thread',
  title: 'Trail map',
  updatedAt: NOW - 90 * MINUTE,
  messages: [
    {id: 'm1', role: 'user', text: 'Map the canyons'},
    {id: 'm2', role: 'assistant', text: 'Fourteen pins, one card each'},
  ],
}

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
  const label = formatRelativeTime({updatedAt: NOW - minutesAgo * MINUTE, now: NOW})

  // then
  expect(label).toBe(expected)
})

test('previewOf collapses the last message to one line', () => {
  // given
  const conversation: Conversation = {
    ...thread,
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
  const conversation = createConversation({id: 'c', now: NOW})

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
  const conversation = createConversation({id: 'fresh', now: NOW})

  // then
  expect(conversation).toEqual({
    id: 'fresh',
    title: NEW_CONVERSATION_TITLE,
    updatedAt: NOW,
    messages: [],
  })
})

test('withMessages titles an untitled conversation from its first message', () => {
  // given
  const conversation = createConversation({id: 'fresh', now: NOW - MINUTE})
  const messages = [{id: 'm1', role: 'user' as const, text: 'Make me a habit tracker'}]

  // when
  const next = withMessages({conversation, messages, now: NOW})

  // then
  expect(next.title).toBe('Make me a habit tracker')
  expect(next.updatedAt).toBe(NOW)
  expect(next.messages).toEqual(messages)
  expect(conversation.messages).toEqual([])
})

test('withMessages keeps an existing title and refreshes the age', () => {
  // given
  const messages = [...thread.messages, {id: 'm3', role: 'user' as const, text: 'One more thing'}]

  // when
  const next = withMessages({conversation: thread, messages, now: NOW})

  // then
  expect(next.title).toBe(thread.title)
  expect(next.updatedAt).toBe(NOW)
  expect(next.messages).toBe(messages)
})

test('withMessages follows a streaming reply by its text, not just its count', () => {
  // given
  const streaming = [thread.messages[0], {...thread.messages[1], text: 'Fourteen pins, one card'}]
  const conversation = withMessages({conversation: thread, messages: streaming, now: NOW - 1})

  // when
  const next = withMessages({conversation, messages: thread.messages, now: NOW})

  // then
  expect(next).not.toBe(conversation)
  expect(next.messages).toBe(thread.messages)
  expect(next.updatedAt).toBe(NOW)
})

test('withMessages returns the same conversation when nothing changed', () => {
  // given
  const same = thread.messages.map((message) => ({...message}))

  // when
  const next = withMessages({conversation: thread, messages: same, now: NOW})

  // then
  expect(next).toBe(thread)
})

test('replaceConversation swaps by id and keeps order', () => {
  // given
  const other = createConversation({id: 'other', now: NOW})
  const conversations = [other, thread]
  const updated = {...thread, title: 'Renamed'}

  // when
  const next = replaceConversation({conversations, conversation: updated})

  // then
  expect(next.map((c) => c.id)).toEqual(['other', 'thread'])
  expect(next[1]).toBe(updated)
  expect(next[0]).toBe(other)
})

test('messagesFromUI joins the text parts and leaves the rest out', () => {
  // given
  const ui: Array<UIMessage> = [
    {id: 'sys', role: 'system', parts: [{type: 'text', content: 'Be brief'}]},
    {id: 'u1', role: 'user', parts: [{type: 'text', content: 'Map the canyons'}]},
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {type: 'thinking', content: 'They want a map'},
        {type: 'text', content: 'Fourteen pins, '},
        {type: 'text', content: 'one card each'},
      ],
    },
  ]

  // when
  const messages = messagesFromUI(ui)

  // then
  expect(messages).toEqual([
    {id: 'u1', role: 'user', text: 'Map the canyons'},
    {id: 'a1', role: 'assistant', text: 'Fourteen pins, one card each'},
  ])
})

test('messageToUI round-trips through messagesFromUI', () => {
  // when
  const ui = thread.messages.map(messageToUI)

  // then
  expect(ui[0]).toEqual({
    id: 'm1',
    role: 'user',
    parts: [{type: 'text', content: 'Map the canyons'}],
  })
  expect(messagesFromUI(ui)).toEqual(thread.messages)
})
