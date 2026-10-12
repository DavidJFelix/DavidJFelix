import {expect, test, vi} from 'vitest'
import {z} from 'zod'
import {
  addUsage,
  type ChatRequest,
  createOpenRouterChat,
  extractJson,
  type Fetch,
  OpenRouterError,
} from './openrouter'

const answerSchema = z.looseObject({findings: z.array(z.unknown())})

const request: ChatRequest = {
  model: 'vendor/model',
  messages: [
    {role: 'system', content: 'system text'},
    {role: 'user', content: 'prompt text'},
  ],
}

const sentBody = (fetchStub: ReturnType<typeof vi.fn<Fetch>>, call = 0): unknown => {
  const body = fetchStub.mock.calls[call][1].body
  return typeof body === 'string' ? JSON.parse(body) : undefined
}

test('createOpenRouterChat sends the messages and returns the content with usage', async () => {
  const fetchStub = vi.fn<Fetch>(async () =>
    Response.json({
      choices: [{message: {content: '{"findings": []}'}}],
      usage: {prompt_tokens: 100, completion_tokens: 20, cost: 0.003},
    }),
  )
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub})

  const reply = await chat(request)

  expect(reply).toEqual({
    content: '{"findings": []}',
    toolCalls: [],
    usage: {promptTokens: 100, completionTokens: 20, costUsd: 0.003},
  })
  const [url, init] = fetchStub.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer key')
  expect(sentBody(fetchStub)).toEqual({
    model: 'vendor/model',
    messages: [
      {role: 'system', content: 'system text'},
      {role: 'user', content: 'prompt text'},
    ],
    response_format: {type: 'json_object'},
    temperature: 0,
    usage: {include: true},
  })
})

test('createOpenRouterChat sends tools and tool messages, and returns tool calls', async () => {
  const fetchStub = vi.fn<Fetch>(async () =>
    Response.json({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {id: 'c2', type: 'function', function: {name: 'read_file', arguments: '{}'}},
            ],
          },
        },
      ],
    }),
  )
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub})
  const tool = {name: 'read_file', description: 'Reads', parameters: {type: 'object'}}

  const reply = await chat({
    model: 'vendor/model',
    messages: [
      {role: 'user', content: 'prompt'},
      {role: 'assistant', content: '', toolCalls: [{id: 'c1', name: 'read_file', arguments: '{}'}]},
      {role: 'tool', toolCallId: 'c1', content: 'file text'},
      {role: 'assistant', content: 'thinking', toolCalls: []},
    ],
    tools: [tool],
    toolChoice: 'none',
  })

  expect(reply.toolCalls).toEqual([{id: 'c2', name: 'read_file', arguments: '{}'}])
  expect(reply.content).toBe('')
  expect(sentBody(fetchStub)).toMatchObject({
    messages: [
      {role: 'user', content: 'prompt'},
      {
        role: 'assistant',
        content: null,
        tool_calls: [{id: 'c1', type: 'function', function: {name: 'read_file', arguments: '{}'}}],
      },
      {role: 'tool', tool_call_id: 'c1', content: 'file text'},
      {role: 'assistant', content: 'thinking', tool_calls: []},
    ],
    tools: [{type: 'function', function: tool}],
    tool_choice: 'none',
  })
})

test('createOpenRouterChat lets the model choose tools when no choice is given', async () => {
  const fetchStub = vi.fn<Fetch>(async () => Response.json({choices: [{message: {content: '{}'}}]}))
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub})

  await chat({...request, tools: []})

  expect(sentBody(fetchStub)).toMatchObject({tools: [], tool_choice: 'auto'})
})

test('createOpenRouterChat reports zero usage when the response has none', async () => {
  const chat = createOpenRouterChat({
    apiKey: 'key',
    fetch: async () => Response.json({choices: [{message: {content: '{}'}}]}),
  })

  expect((await chat(request)).usage).toEqual({promptTokens: 0, completionTokens: 0, costUsd: 0})
})

test.each([
  {name: 'a retryable status', failure: () => new Response('busy', {status: 503})},
  {name: 'an error in a 200 response', failure: () => Response.json({error: {message: 'down'}})},
  {
    name: 'a network error',
    failure: () => {
      throw new TypeError('connection reset')
    },
  },
])('createOpenRouterChat retries after $name', async ({failure}) => {
  const fetchStub = vi
    .fn<Fetch>()
    .mockImplementationOnce(async () => failure())
    .mockImplementationOnce(async () => Response.json({choices: [{message: {content: '{}'}}]}))
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub, retryDelaysMs: [0]})

  expect((await chat(request)).content).toBe('{}')
  expect(fetchStub).toHaveBeenCalledTimes(2)
})

test('createOpenRouterChat throws a temporary error when the retries run out', async () => {
  const fetchStub = vi.fn<Fetch>(async () => new Response('rate limited', {status: 429}))
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub, retryDelaysMs: [0, 0]})

  await expect(chat(request)).rejects.toEqual(
    new OpenRouterError('OpenRouter returned 429: rate limited', true),
  )
  expect(fetchStub).toHaveBeenCalledTimes(3)
})

test('createOpenRouterChat does not retry a request that cannot succeed', async () => {
  const fetchStub = vi.fn<Fetch>(async () => new Response('bad key', {status: 401}))
  const chat = createOpenRouterChat({apiKey: 'key', fetch: fetchStub, retryDelaysMs: [0]})

  await expect(chat(request)).rejects.toEqual(
    new OpenRouterError('OpenRouter returned 401: bad key', false),
  )
  expect(fetchStub).toHaveBeenCalledTimes(1)
})

test('createOpenRouterChat throws an error that is not temporary for a response that it cannot read', async () => {
  const chat = createOpenRouterChat({
    apiKey: 'key',
    fetch: async () => Response.json({choices: []}),
  })

  await expect(chat(request)).rejects.toMatchObject({
    message: expect.stringContaining('OpenRouter returned an unexpected response'),
    temporary: false,
  })
})

test('addUsage sums each field', () => {
  expect(
    addUsage(
      {promptTokens: 1, completionTokens: 2, costUsd: 0.5},
      {promptTokens: 10, completionTokens: 20, costUsd: 0.25},
    ),
  ).toEqual({promptTokens: 11, completionTokens: 22, costUsd: 0.75})
})

test('extractJson reads an object wrapped in a Markdown fence', () => {
  expect(extractJson('```json\n{"findings": []}\n```', answerSchema)).toEqual({findings: []})
})

test.each<{name: string; text: string; expected?: unknown}>([
  {name: 'a bare object', text: '{"findings": []}'},
  {
    name: 'a fenced object with prose around it',
    text: 'Here {it} is:\n```json\n{"findings": []}\n```\nDone {x}',
  },
  {name: 'an object inside prose', text: 'Result: {"findings": []} as asked.'},
  {name: 'an object followed by prose', text: '{"findings": []} as asked.'},
  {
    name: 'an object with a fence inside a string value',
    text: '{"findings": [], "note": "```ts\\nx\\n```"}',
    expected: {findings: [], note: '```ts\nx\n```'},
  },
  {name: 'an object after prose with braces', text: 'Here {it} is: {"findings": []}'},
  {name: 'an object before prose with braces', text: '{"findings": []} See {x}.'},
  {name: 'an object after an unclosed brace', text: 'Use { to open: {"findings": []}'},
  {
    name: 'an object with braces and quotes inside a string value, after prose with braces',
    text: 'Here {it} is: {"findings": [], "note": "a \\"}\\" b {"} done',
    expected: {findings: [], note: 'a "}" b {'},
  },
  {
    name: 'an answer after other JSON in the prose',
    text: 'It has {"type": "module"}. {"findings": []}',
  },
  {
    name: 'an answer after quoted JSON that has a findings list inside it',
    text: 'The fixture is {"data": {"findings": []}}. {"findings": [1]}',
    expected: {findings: [1]},
  },
  {
    name: 'an answer that the model wrapped in another object',
    text: '{"review": {"findings": []}}',
  },
])('extractJson reads $name', ({text, expected = {findings: []}}) => {
  expect(extractJson(text, answerSchema)).toEqual(expected)
})

test('extractJson throws when there is no object', () => {
  expect(() => extractJson('no findings', answerSchema)).toThrow(
    'Model response has no JSON object',
  )
})

test('extractJson throws the schema error of the first object when no object matches', () => {
  expect(() => extractJson('{"type": "module"} {"findings": "none"}', answerSchema)).toThrow(
    'expected array, received undefined',
  )
})
