import {expect, test, vi} from 'vitest'
import type {Chat} from './openrouter'
import {type LogWideEvent, logWideEvent, withChatEvents} from './wide-event'

const request = {model: 'vendor/model', messages: [{role: 'user' as const, content: 'Review'}]}
const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const failing: Chat = async () => {
  throw new Error('OpenRouter is down')
}

test('withChatEvents logs the usage of a model call with the shared fields', async () => {
  const log = vi.fn<LogWideEvent>()
  const reply = {content: 'ok', toolCalls: [{id: '1', name: 'read_file', arguments: '{}'}], usage}
  const chat = withChatEvents({chat: async () => reply, log, fields: {pullNumber: 7}})

  await expect(chat(request)).resolves.toBe(reply)

  expect(log).toHaveBeenCalledExactlyOnceWith({
    event: 'model call',
    pullNumber: 7,
    model: 'vendor/model',
    messageCount: 1,
    outcome: 'success',
    durationMs: expect.any(Number),
    toolCallCount: 1,
    promptTokens: 10,
    completionTokens: 5,
    costUsd: 0.01,
  })
})

test('withChatEvents logs a failed model call and throws its error again', async () => {
  const log = vi.fn<LogWideEvent>()
  const chat = withChatEvents({chat: failing, log, fields: {}})

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
