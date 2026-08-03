import {EventType, type StreamChunk} from '@tanstack/ai/client'
import {expect, test} from 'vitest'
import {chatAgentStream, echoReply, lastUserText, type RunAgentInput} from './chat-agent'

async function collect(stream: AsyncIterable<StreamChunk>): Promise<Array<StreamChunk>> {
  const chunks: Array<StreamChunk> = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

const idOf = (chunk: StreamChunk): unknown => ('messageId' in chunk ? chunk.messageId : undefined)

test('lastUserText reads the most recent user message from string content', () => {
  expect(
    lastUserText([
      {role: 'user', content: 'first'},
      {role: 'assistant', content: 'reply'},
      {role: 'user', content: 'second'},
    ]),
  ).toBe('second')
})

test('lastUserText reads text from UIMessage parts', () => {
  expect(lastUserText([{role: 'user', parts: [{type: 'text', text: 'hello from parts'}]}])).toBe(
    'hello from parts',
  )
})

test('lastUserText joins text content parts and ignores non-text parts', () => {
  expect(
    lastUserText([
      {
        role: 'user',
        content: [
          {type: 'text', content: 'describe '},
          {type: 'image', content: 'data:...'},
          {type: 'text', content: 'this'},
        ],
      },
    ]),
  ).toBe('describe this')
})

test('lastUserText returns empty string when there is no user message', () => {
  const noMessages: RunAgentInput['messages'] = undefined
  expect(lastUserText([{role: 'assistant', content: 'hi'}])).toBe('')
  expect(lastUserText(noMessages)).toBe('')
})

test('echoReply repeats trimmed user text', () => {
  expect(echoReply('  hello world  ')).toBe('You said: hello world')
})

test('echoReply falls back to a stub message for empty input', () => {
  expect(echoReply('   ')).toContain('echo stub')
})

test('chatAgentStream emits the AG-UI lifecycle in order', async () => {
  const chunks = await collect(
    chatAgentStream({threadId: 't1', runId: 'r1', messages: [{role: 'user', content: 'hi'}]}),
  )
  const types = chunks.map((chunk) => chunk.type)

  expect(types.at(0)).toBe(EventType.RUN_STARTED)
  expect(types.at(1)).toBe(EventType.TEXT_MESSAGE_START)
  expect(types.at(-2)).toBe(EventType.TEXT_MESSAGE_END)
  expect(types.at(-1)).toBe(EventType.RUN_FINISHED)
  expect(types).toContain(EventType.TEXT_MESSAGE_CONTENT)
})

test('chatAgentStream echoes the user text across its content deltas', async () => {
  const chunks = await collect(
    chatAgentStream({messages: [{role: 'user', content: 'hello world'}]}),
  )
  const streamed = chunks
    .filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)
    .map((chunk) => ('delta' in chunk ? chunk.delta : ''))
    .join('')

  expect(streamed).toBe('You said: hello world')
})

test('chatAgentStream tags every message event with one stable id', async () => {
  const chunks = await collect(chatAgentStream({messages: [{role: 'user', content: 'tag me'}]}))
  const messageIds = new Set(chunks.map((chunk) => idOf(chunk)).filter((id) => id !== undefined))

  expect(messageIds.size).toBe(1)
})

test('chatAgentStream echoes the request thread and run ids on terminal events', async () => {
  const chunks = await collect(
    chatAgentStream({threadId: 't9', runId: 'r9', messages: [{role: 'user', content: 'ids'}]}),
  )
  const finished = chunks.at(-1)

  expect(finished?.type).toBe(EventType.RUN_FINISHED)
  expect(finished && 'threadId' in finished ? finished.threadId : undefined).toBe('t9')
  expect(finished && 'runId' in finished ? finished.runId : undefined).toBe('r9')
})
