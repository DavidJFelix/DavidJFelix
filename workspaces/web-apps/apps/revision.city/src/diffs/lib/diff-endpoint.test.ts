import {expect, test, vi} from 'vitest'

import {handleDiffRequest} from './diff-endpoint'
import type {ResponseCache} from './github-app-budget'
import {encodeCookiePayload} from './github-auth'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const CREDENTIALS = {clientId: 'client-id', clientSecret: 'client-secret'}
const APP_AUTH = `Basic ${btoa('client-id:client-secret')}`
const TOKEN = 'ghu_token'
const VISITOR_AUTH = `Bearer ${TOKEN}`
const JSON_MEDIA_TYPE = 'application/vnd.github+json'
const DIFF_MEDIA_TYPE = 'application/vnd.github.diff'
const DIFF =
  'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n'
const PULL_SOURCE_URL = 'https://github.com/acme/widgets/pull/7'
const PUBLIC_PULL_URL = 'https://github.com/acme/widgets/pull/7.diff'
const RAW_PULL_URL = 'https://patch-diff.githubusercontent.com/raw/acme/widgets/pull/7.diff'
const PULL_API_URL = 'https://api.github.com/repos/acme/widgets/pulls/7'
const COMPARE_API_URL = 'https://api.github.com/repos/acme/widgets/compare/base000...head000'
const PUBLIC_COMMIT_URL = 'https://github.com/acme/widgets/commit/83fea5e.diff'
const COMMIT_API_URL = 'https://api.github.com/repos/acme/widgets/commits/83fea5e'
const TANGLED_PATCH_URL = 'https://tangled.org/acme/widgets/pulls/7.patch'
const REJECTED_KEY = 'https://revision.city/.cache/github/credentials-rejected'
const RATE_LIMITED_KEY = 'https://revision.city/.cache/github/rate-limited'
const RESERVED_KEY = 'https://revision.city/.cache/github/budget-reserved'
const SESSION_COOKIE = `diffs-github-auth=${encodeCookiePayload({accessToken: TOKEN, login: 'reviewer'})}`

interface UpstreamCall {
  url: string
  authorization: string | null
  accept: string | null
}

type UpstreamAnswer = (call: UpstreamCall) => Response

// Answers each upstream URL from a script and records what was asked, so a test
// can assert both the route the endpoint took and the identity it presented.
const stubUpstream = (answers: Record<string, UpstreamAnswer>) => {
  const calls: UpstreamCall[] = []
  const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers)
    const call = {url, authorization: headers.get('authorization'), accept: headers.get('accept')}
    calls.push(call)
    const answer = answers[url]
    if (answer === undefined) {
      throw new Error(`Unexpected fetch: ${url}`)
    }
    return answer(call)
  })
  return {calls, fetchImpl}
}

const diffAnswer = (contentType = 'text/plain; charset=utf-8') =>
  new Response(DIFF, {headers: {'Content-Type': contentType}})

const failureAnswer = (status: number, init: {statusText?: string; headers?: HeadersInit} = {}) =>
  new Response(null, {status, statusText: init.statusText ?? '', headers: init.headers})

const pullMetadataAnswer = () =>
  Response.json({
    base: {sha: 'base000', repo: {full_name: 'acme/widgets'}},
    head: {sha: 'head000', repo: {full_name: 'acme/widgets'}},
  })

const diffRequest = (search: string, cookie?: string) =>
  new Request(`https://revision.city/api/diffs/diff?${search}`, {
    headers: cookie === undefined ? {} : {cookie},
  })

// Each failed attempt is logged; the spy keeps that out of the test output and
// lets a test read what was logged. Restored by the test that took it.
const spyOnWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

// The Workers cache hands back a fresh Response per match, so the double
// clones what it stored rather than sharing one consumed body.
const fakeCache = () => {
  const entries = new Map<string, Response>()
  const cache: ResponseCache = {
    match: async (key) => entries.get(key.url)?.clone(),
    put: async (key, response) => {
      entries.set(key.url, response)
    },
  }
  return {cache, entries}
}

const maxAge = (entries: Map<string, Response>, key: string) =>
  entries.get(key)?.headers.get('Cache-Control')

// The endpoint's JSON error body, read without trusting its shape.
const readError = async (response: Response): Promise<{message: string; remedy: unknown}> => {
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    throw new Error('Expected a JSON error body.')
  }
  return {message: String(body.message), remedy: 'remedy' in body ? body.remedy : undefined}
}

test.each([
  {name: 'a GitHub path', search: 'path=/acme/widgets/pull/7', publicURL: PUBLIC_PULL_URL},
  {
    name: 'a patch-diff URL',
    search: `url=${encodeURIComponent(RAW_PULL_URL)}`,
    publicURL: RAW_PULL_URL,
  },
])(
  'a signed-out pull request from $name falls back to the API as the app when the public route fails',
  async ({search, publicURL}) => {
    const warn = spyOnWarnings()
    const upstream = stubUpstream({
      [publicURL]: () => failureAnswer(503, {statusText: 'Service Unavailable'}),
      [PULL_API_URL]: () => pullMetadataAnswer(),
      [COMPARE_API_URL]: () => diffAnswer(`${DIFF_MEDIA_TYPE}; charset=utf-8`),
    })

    const response = await handleDiffRequest(diffRequest(search), {
      credentials: CREDENTIALS,
      fetch: upstream.fetchImpl,
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(DIFF)
    expect(response.headers.get('X-Patch-Source')).toBe(PULL_SOURCE_URL)
    expect(upstream.calls).toEqual([
      {url: publicURL, authorization: null, accept: null},
      {url: PULL_API_URL, authorization: APP_AUTH, accept: JSON_MEDIA_TYPE},
      {url: COMPARE_API_URL, authorization: APP_AUTH, accept: DIFF_MEDIA_TYPE},
    ])
    warn.mockRestore()
  },
)

test('a signed-out commit falls back to the commit diff API as the app', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({
    [PUBLIC_COMMIT_URL]: () => failureAnswer(502),
    [COMMIT_API_URL]: () => diffAnswer(`${DIFF_MEDIA_TYPE}; charset=utf-8`),
  })

  const response = await handleDiffRequest(diffRequest('path=/acme/widgets/commit/83fea5e'), {
    credentials: CREDENTIALS,
    fetch: upstream.fetchImpl,
  })

  expect(response.status).toBe(200)
  expect(await response.text()).toBe(DIFF)
  expect(upstream.calls).toEqual([
    {url: PUBLIC_COMMIT_URL, authorization: null, accept: null},
    {url: COMMIT_API_URL, authorization: APP_AUTH, accept: DIFF_MEDIA_TYPE},
  ])
  warn.mockRestore()
})

test('a signed-out 404 spends nothing on the app credentials and asks for a sign-in', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({[PUBLIC_PULL_URL]: () => failureAnswer(404)})

  const response = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), {
    credentials: CREDENTIALS,
    fetch: upstream.fetchImpl,
  })

  expect(response.status).toBe(404)
  const body = await readError(response)
  expect(body.remedy).toEqual({kind: 'sign-in'})
  expect(body.message).toContain('acme/widgets')
  expect(upstream.calls).toHaveLength(1)
  warn.mockRestore()
})

test.each([
  {status: 503, statusText: 'Service Unavailable', expected: '503 Service Unavailable'},
  {status: 500, statusText: '', expected: 'with 500.'},
  {status: 429, statusText: 'Too Many Requests', expected: '429 Too Many Requests'},
])(
  'a signed-out $status with no fallback configured offers the sign-in',
  async ({status, statusText, expected}) => {
    const warn = spyOnWarnings()
    const upstream = stubUpstream({[PUBLIC_PULL_URL]: () => failureAnswer(status, {statusText})})

    const response = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), {
      fetch: upstream.fetchImpl,
    })

    expect(response.status).toBe(status)
    const body = await readError(response)
    expect(body.remedy).toEqual({kind: 'sign-in'})
    expect(body.message).toContain(expected)
    expect(body.message).toContain('Signing in with GitHub')
    expect(response.headers.get('X-Patch-Source')).toBe(PULL_SOURCE_URL)
    expect(upstream.calls).toHaveLength(1)
    warn.mockRestore()
  },
)

test('a signed-out diff both routes turn away reports the last status, the sign-in, and one log line per attempt', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: () => failureAnswer(503),
    [PULL_API_URL]: () =>
      failureAnswer(429, {headers: {'retry-after': '30', 'x-ratelimit-remaining': '0'}}),
  })

  const response = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), {
    credentials: CREDENTIALS,
    fetch: upstream.fetchImpl,
  })

  expect(response.status).toBe(429)
  expect((await readError(response)).remedy).toEqual({kind: 'sign-in'})
  expect(warn.mock.calls).toEqual([
    [
      'diff upstream attempt failed',
      expect.objectContaining({
        target: 'public github.com diff URL',
        url: PUBLIC_PULL_URL,
        source: PULL_SOURCE_URL,
        signedIn: false,
        status: 503,
      }),
    ],
    [
      'diff upstream attempt failed',
      expect.objectContaining({
        target: 'app-authenticated pull metadata',
        url: PULL_API_URL,
        status: 429,
        retryAfter: '30',
        rateLimitRemaining: '0',
      }),
    ],
  ])
  warn.mockRestore()
})

test('a signed-out network failure is logged with its error and the fallback still runs', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({
    [PULL_API_URL]: () => pullMetadataAnswer(),
    [COMPARE_API_URL]: () => diffAnswer(`${DIFF_MEDIA_TYPE}; charset=utf-8`),
  })

  const response = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), {
    credentials: CREDENTIALS,
    fetch: upstream.fetchImpl,
  })

  expect(response.status).toBe(200)
  expect(warn).toHaveBeenCalledWith(
    'diff upstream attempt failed',
    expect.objectContaining({
      target: 'public github.com diff URL',
      error: `Unexpected fetch: ${PUBLIC_PULL_URL}`,
    }),
  )
  warn.mockRestore()
})

test('a non-GitHub patch that fails gets no sign-in, since signing in cannot reach it', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({[TANGLED_PATCH_URL]: () => failureAnswer(503)})

  const response = await handleDiffRequest(
    diffRequest('path=/acme/widgets/pulls/7&domain=tangled.org'),
    {credentials: CREDENTIALS, fetch: upstream.fetchImpl},
  )

  expect(response.status).toBe(503)
  const body = await readError(response)
  expect(body.remedy).toBeUndefined()
  expect(body.message).toBe('Failed to fetch patch from upstream: 503.')
  expect(upstream.calls).toHaveLength(1)
  warn.mockRestore()
})

test('a signed-in diff retries github.com with the visitor token before the API, and never as the app', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: (call) =>
      call.authorization === VISITOR_AUTH ? diffAnswer() : failureAnswer(503),
  })

  const response = await handleDiffRequest(
    diffRequest('path=/acme/widgets/pull/7', SESSION_COOKIE),
    {
      credentials: CREDENTIALS,
      fetch: upstream.fetchImpl,
    },
  )

  expect(response.status).toBe(200)
  expect(await response.text()).toBe(DIFF)
  expect(upstream.calls).toEqual([
    {url: PUBLIC_PULL_URL, authorization: null, accept: null},
    {url: PUBLIC_PULL_URL, authorization: VISITOR_AUTH, accept: null},
  ])
  warn.mockRestore()
})

test('a signed-in 404 still reaches the API as the visitor, whose token can see a private repository', async () => {
  const warn = spyOnWarnings()
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: () => failureAnswer(404),
    [PULL_API_URL]: () => pullMetadataAnswer(),
    [COMPARE_API_URL]: () => diffAnswer(`${DIFF_MEDIA_TYPE}; charset=utf-8`),
  })

  const response = await handleDiffRequest(
    diffRequest('path=/acme/widgets/pull/7', SESSION_COOKIE),
    {
      credentials: CREDENTIALS,
      fetch: upstream.fetchImpl,
    },
  )

  expect(response.status).toBe(200)
  expect(upstream.calls.map((call) => [call.url, call.authorization])).toEqual([
    [PUBLIC_PULL_URL, null],
    [PUBLIC_PULL_URL, VISITOR_AUTH],
    [PULL_API_URL, VISITOR_AUTH],
    [COMPARE_API_URL, VISITOR_AUTH],
  ])
  warn.mockRestore()
})

test.each([
  {key: RATE_LIMITED_KEY, hold: 'rate-limited'},
  {key: REJECTED_KEY, hold: 'credentials-rejected'},
  {key: RESERVED_KEY, hold: 'reserved'},
])(
  'a signed-out diff leaves the app credentials alone while the edge remembers $hold',
  async ({key, hold}) => {
    const warn = spyOnWarnings()
    const {cache, entries} = fakeCache()
    entries.set(key, Response.json({marked: true}))
    const upstream = stubUpstream({[PUBLIC_PULL_URL]: () => failureAnswer(503)})

    const response = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), {
      cache,
      credentials: CREDENTIALS,
      fetch: upstream.fetchImpl,
    })

    expect(response.status).toBe(503)
    expect((await readError(response)).remedy).toEqual({kind: 'sign-in'})
    expect(upstream.calls).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(
      'diff app fallback withheld',
      expect.objectContaining({target: 'app-authenticated pull metadata', hold}),
    )
    warn.mockRestore()
  },
)

test('remembers GitHub rejecting the app credentials, so the next signed-out diff does not offer them', async () => {
  const warn = spyOnWarnings()
  const {cache, entries} = fakeCache()
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: () => failureAnswer(503),
    [PULL_API_URL]: () => failureAnswer(401),
  })
  const options = {cache, credentials: CREDENTIALS, fetch: upstream.fetchImpl}

  const first = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)
  const second = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)

  expect(first.status).toBe(401)
  expect(second.status).toBe(503)
  expect(upstream.calls.map((call) => call.url)).toEqual([
    PUBLIC_PULL_URL,
    PULL_API_URL,
    PUBLIC_PULL_URL,
  ])
  expect(maxAge(entries, REJECTED_KEY)).toBe('public, max-age=3600')
  warn.mockRestore()
})

test('stays off the API until the reset once GitHub says the app budget is spent', async () => {
  const warn = spyOnWarnings()
  const {cache, entries} = fakeCache()
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: () => failureAnswer(503),
    [PULL_API_URL]: () => failureAnswer(429, {headers: {'retry-after': '30'}}),
  })
  const options = {cache, credentials: CREDENTIALS, fetch: upstream.fetchImpl}

  const first = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)
  const second = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)

  expect(first.status).toBe(429)
  expect(second.status).toBe(503)
  expect(upstream.calls.map((call) => call.url)).toEqual([
    PUBLIC_PULL_URL,
    PULL_API_URL,
    PUBLIC_PULL_URL,
  ])
  expect(maxAge(entries, RATE_LIMITED_KEY)).toBe('public, max-age=30')
  warn.mockRestore()
})

// The fallback that got through still reports what is left, and stands down
// under the reserve until the reset, leaving the rest of the hour to the cards.
test('stands down under the reserve after a fallback that succeeded reports a low count', async () => {
  const warn = spyOnWarnings()
  const {cache, entries} = fakeCache()
  const now = 1_790_000_000_000
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const upstream = stubUpstream({
      [PUBLIC_PULL_URL]: () => failureAnswer(503),
      [PULL_API_URL]: () => pullMetadataAnswer(),
      [COMPARE_API_URL]: () =>
        new Response(DIFF, {
          headers: {
            'Content-Type': `${DIFF_MEDIA_TYPE}; charset=utf-8`,
            'x-ratelimit-remaining': '999',
            'x-ratelimit-reset': String(now / 1000 + 120),
          },
        }),
    })
    const options = {cache, credentials: CREDENTIALS, fetch: upstream.fetchImpl}

    const first = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)
    const second = await handleDiffRequest(diffRequest('path=/acme/widgets/pull/7'), options)

    expect(first.status).toBe(200)
    expect(await first.text()).toBe(DIFF)
    expect(second.status).toBe(503)
    expect(upstream.calls.map((call) => call.url)).toEqual([
      PUBLIC_PULL_URL,
      PULL_API_URL,
      COMPARE_API_URL,
      PUBLIC_PULL_URL,
    ])
    expect(maxAge(entries, RESERVED_KEY)).toBe('public, max-age=120')
    expect(warn).toHaveBeenCalledWith(
      'diff app fallback withheld',
      expect.objectContaining({hold: 'reserved'}),
    )
  } finally {
    clock.mockRestore()
    warn.mockRestore()
  }
})

test('a signed-in diff never consults the app budget', async () => {
  const warn = spyOnWarnings()
  const match = vi.fn<ResponseCache['match']>(async () => undefined)
  const cache: ResponseCache = {match, put: async () => undefined}
  const upstream = stubUpstream({
    [PUBLIC_PULL_URL]: (call) =>
      call.authorization === VISITOR_AUTH ? diffAnswer() : failureAnswer(503),
  })

  const response = await handleDiffRequest(
    diffRequest('path=/acme/widgets/pull/7', SESSION_COOKIE),
    {cache, credentials: CREDENTIALS, fetch: upstream.fetchImpl},
  )

  expect(response.status).toBe(200)
  expect(match).not.toHaveBeenCalled()
  warn.mockRestore()
})
