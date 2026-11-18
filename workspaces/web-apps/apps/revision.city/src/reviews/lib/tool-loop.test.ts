import {expect, test, vi} from 'vitest'
import {type Chat, type ChatReply, OpenRouterError, type ToolCall} from './openrouter'
import type {ReviewTools, ToolOutput} from './review-tools'
import {MAX_TOOL_ROUNDS, runToolLoop, SUBMIT_ANSWER_TOOL} from './tool-loop'

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
  'The other tools are off now. Call submit_answer with the JSON answer that the instructions give. Leave out each finding that you could not check.'

const submitAnswer = (id: string, answerJson: string): ToolCall => ({
  id,
  name: SUBMIT_ANSWER_TOOL.name,
  arguments: answerJson,
})

test('runToolLoop makes one call without tools', async () => {
  const chat = vi.fn<Chat>(async () => answer('{"findings": []}'))

  const result = await runToolLoop({...params, chat})

  expect(result).toEqual({text: '{"findings": []}', usage, reads: []})
  expect(chat).toHaveBeenCalledWith({
    model: 'vendor/model',
    eventFields: {round: 0},
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
  expect(lastRequest.tools).toEqual([...tools.definitions, SUBMIT_ANSWER_TOOL])
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
  expect(chat.mock.calls.at(-1)?.[0].toolChoice).toBe('required')
  expect(chat.mock.calls.at(-1)?.[0].tools).toEqual([SUBMIT_ANSWER_TOOL])
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
  expect(chat.mock.calls[1][0].toolChoice).toBe('required')
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

test('runToolLoop fails when the token limit also cuts the answer without reasoning', async () => {
  const chat = vi.fn<Chat>(async () => ({...answer(''), finishReason: 'length'}))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Empty answer: finish reason length, 5 output tokens', false),
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
  })
  expect(chat).toHaveBeenCalledTimes(2)
})

test('runToolLoop asks for the answer without reasoning after the token limit cuts a reply, with the files read so far', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts')))
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce(callTools(submitAnswer('2', '{"findings": []}')))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    text: '{"findings": []}',
    usage: {promptTokens: 30, completionTokens: 15, costUsd: 0.03},
    reads: [{path: 'a.ts', sha: 'sha-a.ts'}],
  })
  const [cut, withoutReasoning] = chat.mock.calls.slice(1).map(([request]) => request)
  expect(withoutReasoning).toEqual({
    model: 'vendor/model',
    eventFields: {round: 1},
    reasoning: 'off',
    messages: [
      ...cut.messages.slice(0, -1),
      {role: 'tool', toolCallId: '1', content: `text of a.ts\n\n${ANSWER_NOW_NOTE}`},
    ],
    tools: [SUBMIT_ANSWER_TOOL],
    toolChoice: 'required',
  })
})

test('runToolLoop asks for the answer without reasoning and without tools when the review has no tools', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce(answer('{"findings": []}'))

  const result = await runToolLoop({...params, chat})

  expect(result).toMatchObject({text: '{"findings": []}'})
  expect(chat.mock.calls[1][0]).toEqual({...chat.mock.calls[0][0], reasoning: 'off'})
})

test('runToolLoop keeps the billed usage when the call without reasoning fails', async () => {
  const failure = new Error('OpenRouter returned 400')
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockRejectedValueOnce(failure)

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({error: failure, usage})
})

test('runToolLoop fails an empty answer without reasoning', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce({...answer(''), finishReason: 'stop'})

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Empty answer: finish reason stop, 5 output tokens', false),
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
  })
})

test('runToolLoop does not ask again after an empty answer that stopped for another reason', async () => {
  const chat = vi.fn<Chat>(async () => ({...answer(''), finishReason: 'stop'}))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Empty answer: finish reason stop, 5 output tokens', false),
    usage,
  })
  expect(chat).toHaveBeenCalledTimes(1)
})

test('runToolLoop tells the logs the round of each model call', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts')))
    .mockResolvedValueOnce({...answer(''), finishReason: 'length'})
    .mockResolvedValueOnce(answer('{"findings": []}'))

  await runToolLoop({...params, chat, tools: fakeTools(), eventFields: {reviewer: 'security'}})

  expect(chat.mock.calls.map(([request]) => request.eventFields)).toEqual([
    {reviewer: 'security', round: 0},
    {reviewer: 'security', round: 1},
    {reviewer: 'security', round: 1},
  ])
})

test('runToolLoop takes the arguments of a submit_answer call as the answer', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce(callTools(readCall('1', 'a.ts')))
    .mockResolvedValueOnce(callTools(readCall('2', 'b.ts'), submitAnswer('3', '{"findings": []}')))
  const tools = fakeTools()

  const result = await runToolLoop({...params, chat, tools})

  expect(result).toEqual({
    text: '{"findings": []}',
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
    reads: [{path: 'a.ts', sha: 'sha-a.ts'}],
  })
  expect(tools.run).toHaveBeenCalledTimes(1)
})

test('runToolLoop takes a submit_answer call on the last round as the answer', async () => {
  const chat = vi.fn<Chat>(async (request) =>
    request.toolChoice === 'required'
      ? callTools(submitAnswer('9', '{"findings": []}'))
      : callTools(readCall('1', 'a.ts')),
  )

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(chat).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1)
  expect(result).toMatchObject({text: '{"findings": []}'})
})

test('runToolLoop takes a text answer on the last round when the provider does not force the tool call', async () => {
  const chat = vi.fn<Chat>(async (request) =>
    request.toolChoice === 'required'
      ? answer('{"findings": []}')
      : callTools(readCall('1', 'a.ts')),
  )

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toMatchObject({text: '{"findings": []}'})
})

test('runToolLoop takes the text answer when submit_answer has empty arguments', async () => {
  const chat = vi.fn<Chat>(async () => ({
    ...answer('{"findings": []}'),
    toolCalls: [submitAnswer('1', '')],
  }))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toMatchObject({text: '{"findings": []}'})
})

test('runToolLoop takes the text answer when submit_answer has an empty object', async () => {
  const chat = vi.fn<Chat>(async () => ({
    ...answer('{"findings": []}'),
    toolCalls: [submitAnswer('1', ' { } ')],
  }))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toMatchObject({text: '{"findings": []}'})
})

test('runToolLoop keeps an empty submit_answer object when the text has no JSON answer', async () => {
  const chat = vi.fn<Chat>(async () => ({
    ...answer('I found no problems.'),
    toolCalls: [submitAnswer('1', '{}')],
  }))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toMatchObject({text: '{}'})
})

test('runToolLoop takes the submit_answer arguments over a JSON answer in the text', async () => {
  const chat = vi.fn<Chat>(async () => ({
    ...answer('{"findings": []}'),
    toolCalls: [submitAnswer('1', '{"findings": [{"title": "A"}]}')],
  }))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toMatchObject({text: '{"findings": [{"title": "A"}]}'})
})

test('runToolLoop asks again without reasoning when the token limit cuts a submit_answer call', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({
      ...callTools(submitAnswer('1', '{"findings": [{"sev')),
      finishReason: 'length',
    })
    .mockResolvedValueOnce(callTools(submitAnswer('2', '{"findings": []}')))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(chat).toHaveBeenCalledTimes(2)
  expect(chat.mock.calls[1][0].reasoning).toBe('off')
  expect(result).toMatchObject({text: '{"findings": []}'})
})

test('runToolLoop fails a submit_answer call that the token limit also cuts without reasoning', async () => {
  const chat = vi.fn<Chat>(async () => ({
    ...callTools(submitAnswer('1', '{"findings": [')),
    finishReason: 'length',
  }))

  const result = await runToolLoop({...params, chat, tools: fakeTools()})

  expect(result).toEqual({
    error: new OpenRouterError('Answer cut at the output token limit: 5 output tokens', false),
    usage: {promptTokens: 20, completionTokens: 10, costUsd: 0.02},
  })
})
