import {expect, test, vi} from 'vitest'
import {createOpenRouterComplete, extractJson, type Fetch} from './openrouter'

const request = {model: 'vendor/model', system: 'system text', prompt: 'prompt text'}

test('createOpenRouterComplete sends the prompt and returns text with usage', async () => {
  const fetchStub = vi.fn<Fetch>(async () =>
    Response.json({
      choices: [{message: {content: '{"findings": []}'}}],
      usage: {prompt_tokens: 100, completion_tokens: 20, cost: 0.003},
    }),
  )
  const complete = createOpenRouterComplete({apiKey: 'key', fetch: fetchStub})

  const completion = await complete(request)

  expect(completion).toEqual({
    text: '{"findings": []}',
    usage: {promptTokens: 100, completionTokens: 20, costUsd: 0.003},
  })
  const [url, init] = fetchStub.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer key')
  expect(typeof init.body === 'string' && JSON.parse(init.body)).toMatchObject({
    model: 'vendor/model',
    messages: [
      {role: 'system', content: 'system text'},
      {role: 'user', content: 'prompt text'},
    ],
  })
})

test('createOpenRouterComplete reports zero usage when the response has none', async () => {
  const complete = createOpenRouterComplete({
    apiKey: 'key',
    fetch: async () => Response.json({choices: [{message: {content: '{}'}}]}),
  })

  expect((await complete(request)).usage).toEqual({
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
  })
})

test('createOpenRouterComplete throws on an error status', async () => {
  const complete = createOpenRouterComplete({
    apiKey: 'key',
    fetch: async () => new Response('rate limited', {status: 429}),
  })

  await expect(complete(request)).rejects.toThrow('OpenRouter returned 429: rate limited')
})

test('extractJson reads an object wrapped in a Markdown fence', () => {
  expect(extractJson('```json\n{"findings": []}\n```')).toEqual({findings: []})
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
])('extractJson reads $name', ({text, expected = {findings: []}}) => {
  expect(extractJson(text)).toEqual(expected)
})

test('extractJson throws when there is no object', () => {
  expect(() => extractJson('no findings')).toThrow('Model response has no JSON object')
})
