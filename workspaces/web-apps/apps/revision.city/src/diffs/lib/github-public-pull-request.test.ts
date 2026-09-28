import {expect, test, vi} from 'vitest'

import type {ResponseCache} from './github-app-budget'
import {fetchPublicPullRequest, type PublicPullRequest} from './github-public-pull-request'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const REPO = {owner: 'acme', repo: 'widgets'}
const NUMBER = '7'
const PULLS_URL = 'https://api.github.com/repos/acme/widgets/pulls/'
const CREDENTIALS = {clientId: 'client-id', clientSecret: 'client-secret'}
const BASIC_AUTH = `Basic ${btoa('client-id:client-secret')}`
const REJECTED_KEY = 'https://revision.city/.cache/github/credentials-rejected'
const RATE_LIMITED_KEY = 'https://revision.city/.cache/github/rate-limited'
const EXPECTED_PULL: PublicPullRequest = {
  title: 'Add widgets',
  author: 'maintainer',
  state: 'open',
  draft: false,
  additions: 12,
  deletions: 3,
  changedFiles: 2,
}

const pullPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Add widgets',
  user: {login: 'maintainer'},
  state: 'open',
  draft: false,
  merged: false,
  additions: 12,
  deletions: 3,
  changed_files: 2,
  ...overrides,
})

// Stands in for GitHub's pull request endpoint, answering with whatever the
// test hands it and failing loudly on any other URL.
const stubGitHub = (respond: (init: RequestInit | undefined) => Response | Promise<Response>) =>
  vi.fn<FetchLike>(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(PULLS_URL)) {
      throw new Error(`Unexpected fetch: ${url}`)
    }
    return respond(init)
  })

// A body that never arrives, until the deadline's abort tears it down.
const stalledBody = (init: RequestInit | undefined) =>
  new ReadableStream({
    start(controller) {
      init?.signal?.addEventListener('abort', () => {
        controller.error(new Error('aborted'))
      })
    },
  })

const readHeader = (init: RequestInit | undefined, name: string) =>
  new Headers(init?.headers).get(name)

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

const cachedEntry = async (entries: Map<string, Response>) => {
  const [entry] = entries.values()
  const body: unknown = await entry?.clone().json()
  return {body, cacheControl: entry?.headers.get('Cache-Control')}
}

test('reads a public pull request with the app credentials as basic auth', async () => {
  let seen: RequestInit | undefined
  const fetchImpl = stubGitHub((init) => {
    seen = init
    return Response.json(pullPayload())
  })

  const pull = await fetchPublicPullRequest({
    repo: REPO,
    number: NUMBER,
    fetch: fetchImpl,
    credentials: CREDENTIALS,
    cache: undefined,
  })

  expect(pull).toEqual(EXPECTED_PULL)
  expect(readHeader(seen, 'Authorization')).toBe(BASIC_AUTH)
  expect(readHeader(seen, 'Accept')).toBe('application/vnd.github+json')
  expect(readHeader(seen, 'Cookie')).toBeNull()
})

test('asks anonymously when the app has no credentials', async () => {
  let seen: RequestInit | undefined
  const fetchImpl = stubGitHub((init) => {
    seen = init
    return Response.json(pullPayload())
  })

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl})

  expect(pull?.title).toBe('Add widgets')
  expect(readHeader(seen, 'Authorization')).toBeNull()
})

test.each([
  {name: 'a merged pull request', overrides: {merged: true, state: 'closed'}, state: 'merged'},
  {name: 'a closed pull request', overrides: {state: 'closed'}, state: 'closed'},
  {name: 'an open draft', overrides: {draft: true}, state: 'open'},
])('reads the state of $name', async ({overrides, state}) => {
  const fetchImpl = stubGitHub(() => Response.json(pullPayload(overrides)))

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl})

  expect(pull?.state).toBe(state)
  expect(pull?.draft).toBe(overrides.draft === true)
})

test('leaves out the author and the counts GitHub did not send', async () => {
  const fetchImpl = stubGitHub(() =>
    Response.json({
      ...pullPayload(),
      user: undefined,
      additions: undefined,
      deletions: undefined,
      changed_files: undefined,
    }),
  )

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl})

  expect(pull).toEqual({title: 'Add widgets', state: 'open', draft: false})
})

test('reads a private or missing pull request as absent and remembers the miss briefly', async () => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(() => new Response(null, {status: 404}))

  const first = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})
  const second = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(first).toBeUndefined()
  expect(second).toBeUndefined()
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(await cachedEntry(entries)).toEqual({
    body: {pull: null},
    cacheControl: 'public, max-age=300',
  })
})

test('keeps a hit for an hour and serves the next lookup from the cache', async () => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(() => Response.json(pullPayload({merged: true})))

  const first = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})
  const second = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(first).toEqual({...EXPECTED_PULL, state: 'merged'})
  expect(second).toEqual(first)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect((await cachedEntry(entries)).cacheControl).toBe('public, max-age=3600')
})

test.each([
  {name: 'a server error', respond: () => new Response(null, {status: 500})},
  {name: 'a 403 that names no rate limit', respond: () => new Response(null, {status: 403})},
  {name: 'a payload without a title', respond: () => Response.json({number: 7})},
  {name: 'a body that is not JSON', respond: () => new Response('<html>', {status: 200})},
  {
    name: 'a network failure',
    respond: () => {
      throw new TypeError('fetch failed')
    },
  },
])('reads $name as no answer and asks again next time', async ({respond}) => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(respond)

  const first = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})
  const second = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(first).toBeUndefined()
  expect(second).toBeUndefined()
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  expect(entries.size).toBe(0)
})

// Once GitHub says the budget is spent, asking again would only cost each page
// its wait: lookups stay off GitHub until the reset the answer names, and a
// spent limit is not a miss, so nothing is remembered about the pull request.
test('stays off GitHub until the reset a spent rate limit names', async () => {
  const {cache, entries} = fakeCache()
  const now = 1_790_000_000_000
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const fetchImpl = stubGitHub(
      () =>
        new Response(null, {
          status: 403,
          headers: {'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 120)},
        }),
    )

    const first = await fetchPublicPullRequest({repo: REPO, number: '7', fetch: fetchImpl, cache})
    const second = await fetchPublicPullRequest({repo: REPO, number: '8', fetch: fetchImpl, cache})

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect([...entries.keys()]).toEqual([RATE_LIMITED_KEY])
    expect(entries.get(RATE_LIMITED_KEY)?.headers.get('Cache-Control')).toBe('public, max-age=120')
  } finally {
    clock.mockRestore()
  }
})

const RATE_LIMIT_ANSWERS: Array<{
  name: string
  status: number
  headers: Record<string, string>
  maxAge: number
}> = [
  {name: 'a retry-after header', status: 429, headers: {'retry-after': '30'}, maxAge: 30},
  {name: 'a 429 that names no reset', status: 429, headers: {}, maxAge: 60},
  {
    name: 'a spent limit that names no reset',
    status: 403,
    headers: {'x-ratelimit-remaining': '0'},
    maxAge: 60,
  },
  {
    name: 'a reset that already passed',
    status: 403,
    headers: {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 5),
    },
    maxAge: 60,
  },
  {
    name: 'a reset more than an hour away',
    status: 403,
    headers: {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 7200),
    },
    maxAge: 3600,
  },
]

test.each(RATE_LIMIT_ANSWERS)('waits out $name', async ({status, headers, maxAge}) => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(() => new Response(null, {status, headers}))

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(pull).toBeUndefined()
  expect(entries.get(RATE_LIMITED_KEY)?.headers.get('Cache-Control')).toBe(
    `public, max-age=${maxAge}`,
  )
})

test('gives up when GitHub outlasts the timeout', async () => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(
    (init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      }),
  )

  const pull = await fetchPublicPullRequest({
    repo: REPO,
    number: NUMBER,
    fetch: fetchImpl,
    cache,
    timeoutMs: 5,
  })

  expect(pull).toBeUndefined()
  expect(entries.size).toBe(0)
})

// The headers can arrive in time while the body never does; the deadline has
// to cover reading it, or the page waits on GitHub past the fallback.
test('gives up when the body outlasts the deadline', async () => {
  const {cache, entries} = fakeCache()
  const fetchImpl = stubGitHub(
    (init) =>
      new Response(stalledBody(init), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
  )

  const pull = await fetchPublicPullRequest({
    repo: REPO,
    number: NUMBER,
    fetch: fetchImpl,
    cache,
    timeoutMs: 5,
  })

  expect(pull).toBeUndefined()
  expect(entries.size).toBe(0)
})

test('retries once without credentials when GitHub rejects them', async () => {
  const seen: Array<string | null> = []
  const fetchImpl = stubGitHub((init) => {
    seen.push(readHeader(init, 'Authorization'))
    return seen.length === 1 ? new Response(null, {status: 401}) : Response.json(pullPayload())
  })

  const pull = await fetchPublicPullRequest({
    repo: REPO,
    number: NUMBER,
    fetch: fetchImpl,
    credentials: CREDENTIALS,
  })

  expect(pull?.title).toBe('Add widgets')
  expect(seen).toEqual([BASIC_AUTH, null])
})

// A rejection is remembered at the edge, so it costs one extra call an hour
// rather than one per lookup, and lifts on its own once the hour passes.
test('withholds the credentials for an hour after GitHub rejects them', async () => {
  const {cache, entries} = fakeCache()
  const seen: Array<string | null> = []
  const fetchImpl = stubGitHub((init) => {
    const authorization = readHeader(init, 'Authorization')
    seen.push(authorization)
    return authorization === null ? Response.json(pullPayload()) : new Response(null, {status: 401})
  })

  const first = await fetchPublicPullRequest({
    repo: REPO,
    number: '7',
    fetch: fetchImpl,
    credentials: CREDENTIALS,
    cache,
  })
  const second = await fetchPublicPullRequest({
    repo: REPO,
    number: '8',
    fetch: fetchImpl,
    credentials: CREDENTIALS,
    cache,
  })

  expect(first?.title).toBe('Add widgets')
  expect(second?.title).toBe('Add widgets')
  expect(seen).toEqual([BASIC_AUTH, null, null])
  expect(entries.get(REJECTED_KEY)?.headers.get('Cache-Control')).toBe('public, max-age=3600')
})

test('does not retry an anonymous request GitHub answers 401', async () => {
  const fetchImpl = stubGitHub(() => new Response(null, {status: 401}))

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl})

  expect(pull).toBeUndefined()
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

test.each([
  {name: 'a foreign entry under the key', body: {something: 'else'}},
  {name: 'an entry whose pull request lost its title', body: {pull: {author: 'maintainer'}}},
  {name: 'an entry that is not an object', body: 'stale'},
])('ignores $name and asks GitHub', async ({body}) => {
  const {cache, entries} = fakeCache()
  entries.set('https://revision.city/.cache/github/pulls/acme/widgets/7', Response.json(body))
  const fetchImpl = stubGitHub(() => Response.json(pullPayload()))

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(pull).toEqual(EXPECTED_PULL)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

test('reads a cached entry with unknown state and counts as an open pull request', async () => {
  const {cache, entries} = fakeCache()
  entries.set(
    'https://revision.city/.cache/github/pulls/acme/widgets/7',
    Response.json({pull: {title: 'From the cache', state: 'weird', additions: 'many'}}),
  )
  const fetchImpl = stubGitHub(() => {
    throw new Error('not reached')
  })

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(pull).toEqual({title: 'From the cache', state: 'open', draft: false})
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('treats a cache that throws as empty, on the way in and on the way out', async () => {
  const cache: ResponseCache = {
    match: async () => {
      throw new Error('cache unavailable')
    },
    put: async () => {
      throw new Error('cache unavailable')
    },
  }
  const fetchImpl = stubGitHub(() => Response.json(pullPayload()))

  const pull = await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl, cache})

  expect(pull).toEqual(EXPECTED_PULL)
})

// The stub is undone inline rather than in a hook; the vitest API for that
// is spelled as it is. cSpell:ignore unstubAllGlobals
test('uses the Workers default cache when the runtime provides one', async () => {
  const {cache, entries} = fakeCache()
  vi.stubGlobal('caches', {default: cache})
  try {
    const fetchImpl = stubGitHub(() => Response.json(pullPayload()))
    await fetchPublicPullRequest({repo: REPO, number: NUMBER, fetch: fetchImpl})
    expect([...entries.keys()]).toEqual([
      'https://revision.city/.cache/github/pulls/acme/widgets/7',
    ])
  } finally {
    vi.unstubAllGlobals()
  }
})
