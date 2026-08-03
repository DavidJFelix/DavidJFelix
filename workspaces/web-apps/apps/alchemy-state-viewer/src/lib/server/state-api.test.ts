import {expect, test} from 'vitest'
import {createStateApi, type FetchLike, mapWithConcurrency, StateApiError} from './state-api'

interface Call {
  url: string
  headers: Record<string, string>
}

const stubFetch = (
  responder: (url: string) => Response | Promise<Response>,
  calls: Call[] = [],
): {fetch: FetchLike; calls: Call[]} => {
  const fetchImpl: FetchLike = (input, init) => {
    const url = String(input)
    calls.push({url, headers: init?.headers ?? {}})
    return Promise.resolve(responder(url))
  }
  return {fetch: fetchImpl, calls}
}

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}})

const api = (responder: (url: string) => Response | Promise<Response>, calls: Call[] = []) =>
  createStateApi({
    url: 'https://state.example.com/',
    authToken: 'token-123',
    fetch: stubFetch(responder, calls).fetch,
  })

test('listStacks hits /state/stacks with the bearer token and trims the trailing slash', async () => {
  const calls: Call[] = []
  const stacks = await api(() => json(['stack-b', 'stack-a']), calls).listStacks()
  expect(stacks).toEqual(['stack-b', 'stack-a'])
  expect(calls[0]?.url).toBe('https://state.example.com/state/stacks')
  expect(calls[0]?.headers.authorization).toBe('Bearer token-123')
})

test('listStages and listResources encode path segments', async () => {
  const calls: Call[] = []
  const client = api(() => json([]), calls)
  await client.listStages('my stack')
  await client.listResources('my stack', 'dev/1')
  expect(calls[0]?.url).toBe('https://state.example.com/state/stacks/my%20stack/stages')
  expect(calls[1]?.url).toBe(
    'https://state.example.com/state/stacks/my%20stack/stages/dev%2F1/resources',
  )
})

test('getResource encodes the fqn and parses the state', async () => {
  const calls: Call[] = []
  const state = await api(
    () => json({resourceType: 'AWS.S3.Bucket', status: 'created'}),
    calls,
  ).getResource('stack', 'dev', 'ns/bucket')
  expect(state).toEqual({resourceType: 'AWS.S3.Bucket', status: 'created'})
  expect(calls[0]?.url).toBe(
    'https://state.example.com/state/stacks/stack/stages/dev/resources/ns%2Fbucket',
  )
})

test.each([
  ['empty body', new Response('', {status: 200})],
  ['null body', json(null)],
])('getResource returns undefined for %s', async (_name, response) => {
  const state = await api(() => response).getResource('stack', 'dev', 'gone')
  expect(state).toBeUndefined()
})

test('getStackOutput returns undefined for null and the value otherwise', async () => {
  expect(await api(() => json(null)).getStackOutput('s', 'dev')).toBeUndefined()
  expect(await api(() => json({url: 'https://x'})).getStackOutput('s', 'dev')).toEqual({
    url: 'https://x',
  })
})

test('getVersion returns the version number', async () => {
  expect(await api(() => json({version: 5})).getVersion()).toBe(5)
})

test('getVersion rejects an unexpected shape', async () => {
  await expect(api(() => json({nope: true})).getVersion()).rejects.toThrow(StateApiError)
})

test('401 maps to a token hint with the status attached', async () => {
  const failure = await api(() => new Response('', {status: 401}))
    .listStacks()
    .catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(StateApiError)
  expect((failure as StateApiError).status).toBe(401)
  expect((failure as StateApiError).message).toContain('ALCHEMY_STATE_TOKEN')
})

test('a 500 maps to a StateApiError carrying the status', async () => {
  const failure = await api(() => new Response('boom', {status: 500}))
    .listStacks()
    .catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(StateApiError)
  expect((failure as StateApiError).status).toBe(500)
})

test('a network failure maps to an unreachable error', async () => {
  const client = createStateApi({
    url: 'https://state.example.com',
    authToken: 't',
    fetch: () => Promise.reject(new Error('fetch failed')),
  })
  await expect(client.listStacks()).rejects.toThrow('unreachable')
})

test('invalid JSON maps to a StateApiError', async () => {
  await expect(api(() => new Response('<html>', {status: 200})).listStacks()).rejects.toThrow(
    'invalid JSON',
  )
})

test('a non-string-array listing rejects', async () => {
  await expect(api(() => json([1, 2])).listStacks()).rejects.toThrow('expected string[]')
})

test('mapWithConcurrency preserves order and bounds concurrency', async () => {
  let active = 0
  let peak = 0
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
    active -= 1
    return n * 10
  })
  expect(results).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
  expect(peak).toBeLessThanOrEqual(3)
})

test('mapWithConcurrency handles an empty list', async () => {
  expect(await mapWithConcurrency([], 4, (n: number) => Promise.resolve(n))).toEqual([])
})
