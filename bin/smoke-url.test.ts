import {expect, test} from 'bun:test'
import {type SmokeFetch, type SmokeProbe, checkProbe, checkRoute, retryCheck} from './smoke-url'

const base = 'https://example.com'
const webhook: SmokeProbe = {method: 'POST', path: '/api/github/webhook', status: 401}
const config: SmokeProbe = {
  method: 'GET',
  path: '/api/auth/github/config',
  status: 200,
  bodyIncludes: '"configured":true',
}

// Answers each call with the next response in the list.
const fakeFetch = (responses: readonly Response[]) => {
  const calls: Array<{url: string; method: string | undefined}> = []
  const fetch: SmokeFetch = async (url, init) => {
    calls.push({url: url.href, method: init.method})
    const response = responses[calls.length - 1]
    if (!response) throw new Error('no more fake responses')
    return response
  }
  return {fetch, calls}
}

const noSleep = async () => undefined

test('a route passes when the page and its first asset serve', async () => {
  const {fetch} = fakeFetch([
    new Response('<html><script src="/assets/app.js"></script></html>'),
    new Response('ok'),
  ])

  expect(await checkRoute({base, route: '/', fetch, headers: {}})).toBeNull()
})

test('a probe passes on its exact status and body text', async () => {
  const {fetch, calls} = fakeFetch([
    Response.json({configured: true, callbackURL: `${base}/api/auth/github/callback`}),
  ])

  expect(await checkProbe({base, probe: config, fetch})).toBeNull()
  expect(calls).toEqual([{url: `${base}/api/auth/github/config`, method: 'GET'}])
})

test('a probe fails on a different status and names both statuses', async () => {
  // 503 is the answer when reviews are not set up, the failure the probe is for.
  const {fetch} = fakeFetch([Response.json({error: 'not set up'}, {status: 503})])

  expect(await checkProbe({base, probe: webhook, fetch})).toBe(
    'POST /api/github/webhook -> HTTP 503, wanted HTTP 401',
  )
})

test('a probe fails on its status without the body text', async () => {
  const {fetch} = fakeFetch([Response.json({configured: false})])

  expect(await checkProbe({base, probe: config, fetch})).toBe(
    'GET /api/auth/github/config -> HTTP 200 without the expected body text',
  )
})

test('a probe that fails and then passes passes on retry', async () => {
  const {fetch, calls} = fakeFetch([
    new Response(null, {status: 502}),
    new Response(null, {status: 401}),
  ])
  const delays: Array<number> = []

  const problem = await retryCheck({
    check: () => checkProbe({base, probe: webhook, fetch}),
    attempts: 3,
    retryDelayMs: 5,
    sleep: async (ms) => delays.push(ms),
  })

  expect(problem).toBeNull()
  expect(calls).toHaveLength(2)
  expect(delays).toEqual([5])
})

test('a check that never passes returns its last problem', async () => {
  const {fetch} = fakeFetch([new Response(null, {status: 502}), new Response(null, {status: 503})])

  expect(
    await retryCheck({
      check: () => checkProbe({base, probe: webhook, fetch}),
      attempts: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    }),
  ).toBe('POST /api/github/webhook -> HTTP 503, wanted HTTP 401')
})
