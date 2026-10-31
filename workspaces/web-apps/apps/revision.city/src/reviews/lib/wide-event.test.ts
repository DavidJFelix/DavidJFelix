import {expect, test, vi} from 'vitest'
import type {Chat} from './openrouter'
import {type LogWideEvent, logWideEvent, withChatEvents} from './wide-event'

const request = {
  model: 'vendor/model',
  messages: [{role: 'user' as const, content: 'Review'}],
  eventFields: {reviewer: 'security', round: 0},
}
const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const failing: Chat = async () => {
  throw new Error('OpenRouter is down')
}

test('withChatEvents logs the usage of a model call with the shared fields', async () => {
  const log = vi.fn<LogWideEvent>()
  const reply = {content: 'ok', toolCalls: [{id: '1', name: 'read_file', arguments: '{}'}], usage}
  const chat = withChatEvents({chat: async () => reply, log, sharedFields: {pullNumber: 7}})

  await expect(chat(request)).resolves.toBe(reply)

  expect(log).toHaveBeenCalledExactlyOnceWith({
    event: 'model call',
    pullNumber: 7,
    reviewer: 'security',
    round: 0,
    model: 'vendor/model',
    messageCount: 1,
    promptChars: 6,
    toolChoice: 'no tools',
    maxTokens: 32_000,
    reasoningEffort: 'medium',
    outcome: 'success',
    durationMs: expect.any(Number),
    provider: undefined,
    finishReason: undefined,
    toolCallCount: 1,
    promptTokens: 10,
    completionTokens: 5,
    reasoningTokens: undefined,
    reasoningChars: 0,
    answerChars: 2,
    costUsd: 0.01,
    reasoningTail: undefined,
  })
})

test('withChatEvents logs a failed model call and throws its error again', async () => {
  const log = vi.fn<LogWideEvent>()
  const chat = withChatEvents({chat: failing, log, sharedFields: {}})

  await expect(chat(request)).rejects.toThrow('OpenRouter is down')

  expect(log).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({outcome: 'error', error: 'Error: OpenRouter is down'}),
  )
})

test('logWideEvent logs the event as an object, so Workers Logs keeps its fields', () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  logWideEvent({event: 'review run', pullNumber: 7})

  expect(consoleLog).toHaveBeenCalledExactlyOnceWith({event: 'review run', pullNumber: 7})
  consoleLog.mockRestore()
})

test('withChatEvents logs the reasoning tokens and the end of the reasoning of a cut reply', async () => {
  const log = vi.fn<LogWideEvent>()
  const reasoning = `${'a'.repeat(5000)}${'b'.repeat(2000)}`
  const reply = {
    content: '',
    toolCalls: [],
    usage,
    finishReason: 'length',
    reasoningTokens: 5,
    provider: 'DeepSeek',
    reasoning: {text: reasoning},
  }
  const chat = withChatEvents({chat: async () => reply, log, sharedFields: {}})

  await chat(request)

  expect(log).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      finishReason: 'length',
      provider: 'DeepSeek',
      reasoningTokens: 5,
      reasoningChars: 7000,
      answerChars: 0,
      reasoningTail: 'b'.repeat(2000),
    }),
  )
})

test('withChatEvents keeps no reasoning text of a reply that finished', async () => {
  const log = vi.fn<LogWideEvent>()
  const reply = {content: '{}', toolCalls: [], usage, finishReason: 'stop', reasoning: {text: 'x'}}
  const chat = withChatEvents({chat: async () => reply, log, sharedFields: {}})

  await chat(request)

  expect(log).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({reasoningChars: 1, reasoningTail: undefined}),
  )
})
