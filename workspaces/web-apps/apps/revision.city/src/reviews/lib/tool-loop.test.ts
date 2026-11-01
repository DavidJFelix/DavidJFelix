import {expect, test, vi} from 'vitest'
import {type Chat, type ChatReply, OpenRouterError, type ToolCall} from './openrouter'
import type {ReviewTools, ToolOutput} from './review-tools'
import {MAX_TOOL_ROUNDS, runToolLoop} from './tool-loop'

const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const answer = (content: string): ChatReply => ({content, toolCalls: [], usage})

const callTools = (...calls: ToolCall[]): ChatReply => ({content: '', toolCalls: calls, usage})

const readCall = (id: string, path: string): ToolCall => ({
  id,
  name: 'read_file',
  arguments: JSON.stringify({path}),
})

const fakeTools = (run: (call: ToolCall) => ToolOutput = readOutput): ReviewTools => ({
  definitions: [{name: 'read_file', description: 'Reads', parameters: {type: 'object'}}],
  run: vi.fn<ReviewTools['run']>(async (call) => run(call)),
})

function readOutput(call: ToolCall): ToolOutput {
  const {path} = JSON.parse(call.arguments)
  return {content: `text of ${path}`, read: {path, sha: `sha-${path}`}}
}

const params = {model: 'vendor/model', system: 'system', prompt: 'chunk'}

const ANSWER_NOW_NOTE =
  'The tools are off now. Write your answer as the JSON that the instructions give. Do not write a tool call. Leave out each finding that you could not check.'

test('runToolLoop makes one call without tools', async () => {
  const chat = vi.fn<Chat>(async () => answer('{"findings": []}'))

  const result = await runToolLoop({...params, chat})

  expect(result).toEqual({text: '{"findings": []}', usage, reads: []})
  expect(chat).toHaveBeenCalledWith({
    model: 'vendor/model',
    eventFields: {run: 1, round: 0},
    messages: [
      {role: 'system', content: 'system'},
      {role: 'user', content: 'chunk'},
    ],
  })
})

test('runToolLoop runs the tool calls, sends the results back, and records each path once', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts'), readCall('2', 'b.ts')))
    .mockResolvedValueOnce(callTools(readCall('3', 'a.ts')))
    .mockResolvedValueOnce(answer('{"findings": []}'))
  const tools = fakeTools()

  const result = await runToolLoop({...params, chat, tools})

  expect(result).toEqual({
    text: '{"findings": []}',
    usage: {promptTokens: 30, completionTokens: 15, costUsd: 0.03},
    reads: [
      {path: 'a.ts', sha: 'sha-a.ts'},
      {path: 'b.ts', sha: 'sha-b.ts'},
    ],
  })
  const lastRequest = chat.mock.calls[2][0]
  expect(lastRequest.toolChoice).toBe('auto')
  expect(lastRequest.tools).toBe(tools.definitions)
  expect(lastRequest.messages.slice(2)).toEqual([
    {
      role: 'assistant',
      content: '',
      toolCalls: [readCall('1', 'a.ts'), readCall('2', 'b.ts')],
    },
    {role: 'tool', toolCallId: '1', content: 'text of a.ts'},
    {role: 'tool', toolCallId: '2', content: 'text of b.ts'},
    {role: 'assistant', content: '', toolCalls: [readCall('3', 'a.ts')]},
    {role: 'tool', toolCallId: '3', content: 'text of a.ts'},
  ])
})

test('runToolLoop sends the reasoning of a tool call reply back in the next request', async () => {
  const reasoning = {text: 'I should read a.ts'}
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({...callTools(readCall('1', 'a.ts')), reasoning})
    .mockResolvedValueOnce(answer('{"findings": []}'))

  await runToolLoop({...params, chat, tools: fakeTools()})

  expect(chat.mock.calls[1][0].messages.at(-2)).toEqual({
    role: 'assistant',
    content: '',
    toolCalls: [readCall('1', 'a.ts')],
    reasoning,
  })
})

test('runToolLoop asks for an answer without tools at the end of the last tool result', async () => {
  const chat = vi.fn<Chat>(async () => callTools(readCall('1', 'a.ts')))
  const tools = fakeTools()

  const result = await runToolLoop({...params, chat, tools})

  expect(chat).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1)
  expect(chat.mock.calls.at(-1)?.[0].toolChoice).toBe('none')
  expect(chat.mock.calls.at(-1)?.[0].messages.at(-1)).toEqual({
    role: 'tool',
    toolCallId: '1',
    content: `text of a.ts\n\n${ANSWER_NOW_NOTE}`,
  })
  expect(result).toEqual({
    error: new OpenRouterError(
      'Empty answer: tool calls after the tools were off: 1, 5 output tokens',
      false,
    ),
    usage: {promptTokens: 50, completionTokens: 25, costUsd: 0.05},
  })
  expect(tools.run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS)
})

test('runToolLoop runs at most six calls in one round', async () => {
  const calls = Array.from({length: 8}, (_, index) => readCall(String(index), `${index}.ts`))
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(...calls))
    .mockResolvedValueOnce(answer('{}'))
  const tools = fakeTools()

  await runToolLoop({...params, chat, tools})

  expect(tools.run).toHaveBeenCalledTimes(6)
  expect(chat.mock.calls[1][0].messages.at(-1)).toEqual({
    role: 'tool',
    toolCallId: '7',
    content: 'Not run: too many tool calls in one turn.',
  })
})

test('runToolLoop cuts tool output past its budget and then asks for an answer', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts'), readCall('2', 'b.ts')))
    .mockResolvedValueOnce(answer('{}'))
  const tools = fakeTools((call) => ({...readOutput(call), content: 'x'.repeat(30_000)}))

  const result = await runToolLoop({...params, chat, tools})

  expect(chat.mock.calls[1][0].messages.at(-1)).toEqual({
    role: 'tool',
    toolCallId: '2',
    content: `${'x'.repeat(18_000)}\n(Cut: the tool output limit for this review is used up. Answer with what you have.)\n\n${ANSWER_NOW_NOTE}`,
  })
  expect(chat.mock.calls[1][0].toolChoice).toBe('none')
  // A cut read still counts: the answer may depend on the part the model saw.
  expect(result).toMatchObject({reads: [{path: 'a.ts'}, {path: 'b.ts'}]})
})

test('runToolLoop does not cut tool output between the halves of a surrogate pair', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts'), readCall('2', 'b.ts')))
    .mockResolvedValueOnce(answer('{}'))
  const tools = fakeTools((call) => ({
    ...readOutput(call),
    content: call.id === '1' ? 'x'.repeat(47_997) : '\u{1f600}\u{1f600}',
  }))

  await runToolLoop({...params, chat, tools})

  expect(chat.mock.calls[1][0].messages.at(-1)?.content).toBe(
    `\u{1f600}\n(Cut: the tool output limit for this review is used up. Answer with what you have.)\n\n${ANSWER_NOW_NOTE}`,
  )
})

test('runToolLoop gives no output to calls after the budget is used up', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts'), readCall('2', 'b.ts')))
    .mockResolvedValueOnce(answer('{}'))
  const tools = fakeTools((call) => ({...readOutput(call), content: 'x'.repeat(50_000)}))

  await runToolLoop({...params, chat, tools})

  expect(chat.mock.calls[1][0].messages.at(-1)?.content).toBe(
    `\n(Cut: the tool output limit for this review is used up. Answer with what you have.)\n\n${ANSWER_NOW_NOTE}`,
  )
})

test('runToolLoop keeps no read for a call that looked nothing up', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools({id: '1', name: 'read_file', arguments: '{'}))
    .mockResolvedValueOnce(answer('{}'))
  const tools = fakeTools(() => ({content: 'Invalid arguments for read_file'}))

  expect(await runToolLoop({...params, chat, tools})).toMatchObject({reads: []})
})

test('runToolLoop stops and keeps the billed usage when a later model call fails', async () => {
  const failure = new Error('OpenRouter returned 400')
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts')))
    .mockRejectedValueOnce(failure)

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({error: failure, usage})
})

test('runToolLoop stops and keeps the billed usage when a tool fails', async () => {
  const failure = new Error('GitHub returned 403')
  const chat = vi.fn<Chat>(async () => callTools(readCall('1', 'a.ts')))
  const tools: ReviewTools = {...fakeTools(), run: async () => Promise.reject(failure)}

  const result = await runToolLoop({...params, chat, tools})

  expect(result).toEqual({error: failure, usage})
  expect(chat).toHaveBeenCalledTimes(1)
})

test('runToolLoop runs a review again once when the token limit cuts the answer, and fails the second cut', async () => {
  const chat = vi.fn<Chat>(async () => ({...answer(''), finishReason: 'length'}))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Empty answer: finish reason length, 5 output tokens', false),
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
    cutAtTokenLimit: true,
  })
  expect(chat).toHaveBeenCalledTimes(2)
})

test('runToolLoop returns the second answer after the token limit cuts the first, with the usage of both', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce(answer('{"findings": []}'))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    text: '{"findings": []}',
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
    reads: [],
  })
})

test('runToolLoop does not run a review again after an empty answer that stopped for another reason', async () => {
  const chat = vi.fn<Chat>(async () => ({...answer(''), finishReason: 'stop'}))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Empty answer: finish reason stop, 5 output tokens', false),
    usage,
  })
  expect(chat).toHaveBeenCalledTimes(1)
})

test('runToolLoop tells the logs the run and the round of each model call', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts')))
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce(answer('{"findings": []}'))

  await runToolLoop({...params, chat, tools: fakeTools(), eventFields: {reviewer: 'security'}})

  expect(chat.mock.calls.map(([request]) => request.eventFields)).toEqual([
    {reviewer: 'security', run: 1, round: 0},
    {reviewer: 'security', run: 1, round: 1},
    {reviewer: 'security', run: 2, round: 0},
  ])
})
