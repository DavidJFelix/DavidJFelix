import {expect, test, vi} from 'vitest'

import {noteAppBudgetAnswer, type ResponseCache, readAppBudgetHold} from './github-app-budget'

const REJECTED_KEY = 'https://revision.city/.cache/github/credentials-rejected'
const RATE_LIMITED_KEY = 'https://revision.city/.cache/github/rate-limited'
const RESERVED_KEY = 'https://revision.city/.cache/github/budget-reserved'

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

const marker = () => Response.json({marked: true})

const answer = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, {status, headers})

const maxAge = (entries: Map<string, Response>, key: string) =>
  entries.get(key)?.headers.get('Cache-Control')

test('reads no hold from an empty cache, or from no cache at all', async () => {
  const {cache} = fakeCache()

  expect(await readAppBudgetHold({cache})).toBeUndefined()
  expect(await readAppBudgetHold({cache: undefined})).toBeUndefined()
})

test.each([
  {
    name: 'a spent limit',
    keys: [RESERVED_KEY, REJECTED_KEY, RATE_LIMITED_KEY],
    hold: 'rate-limited',
  },
  {name: 'rejected credentials', keys: [RESERVED_KEY, REJECTED_KEY], hold: 'credentials-rejected'},
  {name: 'the reserve', keys: [RESERVED_KEY], hold: 'reserved'},
])('reads $name as the hold in force', async ({keys, hold}) => {
  const {cache, entries} = fakeCache()
  for (const key of keys) {
    entries.set(key, marker())
  }

  expect(await readAppBudgetHold({cache})).toBe(hold)
})

test('remembers rejected credentials for an hour, but only ones that were offered', async () => {
  const {cache, entries} = fakeCache()

  const anonymous = await noteAppBudgetAnswer({cache, response: answer(401), offered: false})
  const offered = await noteAppBudgetAnswer({cache, response: answer(401), offered: true})

  expect(anonymous).toBeUndefined()
  expect(offered).toBe('credentials-rejected')
  expect([...entries.keys()]).toEqual([REJECTED_KEY])
  expect(maxAge(entries, REJECTED_KEY)).toBe('public, max-age=3600')
})

test('remembers a spent limit for as long as the answer asks, offered or not', async () => {
  const {cache, entries} = fakeCache()

  const hold = await noteAppBudgetAnswer({
    cache,
    response: answer(429, {'retry-after': '30'}),
    offered: false,
  })

  expect(hold).toBe('rate-limited')
  expect(maxAge(entries, RATE_LIMITED_KEY)).toBe('public, max-age=30')
})

test('stands down under the reserve until the reset the answer names', async () => {
  const {cache, entries} = fakeCache()
  const now = 1_790_000_000_000
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const hold = await noteAppBudgetAnswer({
      cache,
      response: answer(200, {
        'x-ratelimit-remaining': '999',
        'x-ratelimit-reset': String(now / 1000 + 120),
      }),
      offered: true,
    })

    expect(hold).toBe('reserved')
    expect(maxAge(entries, RESERVED_KEY)).toBe('public, max-age=120')
  } finally {
    clock.mockRestore()
  }
})

test('stands down for a minute when a low count names no reset', async () => {
  const {cache, entries} = fakeCache()

  await noteAppBudgetAnswer({
    cache,
    response: answer(200, {'x-ratelimit-remaining': '12'}),
    offered: true,
  })

  expect(maxAge(entries, RESERVED_KEY)).toBe('public, max-age=60')
})

const NOTHING_TO_NOTE: Array<{
  name: string
  status: number
  headers: Record<string, string>
  offered: boolean
}> = [
  {name: 'a success with no count', status: 200, headers: {}, offered: true},
  {
    name: 'a count at the reserve',
    status: 200,
    headers: {'x-ratelimit-remaining': '1000'},
    offered: true,
  },
  {
    name: 'a count that is not a number',
    status: 200,
    headers: {'x-ratelimit-remaining': 'many'},
    offered: true,
  },
  {
    name: "an address's own low count",
    status: 200,
    headers: {'x-ratelimit-remaining': '3'},
    offered: false,
  },
  {name: 'a 403 that names no rate limit', status: 403, headers: {}, offered: true},
  {name: 'a 404', status: 404, headers: {}, offered: true},
]

test.each(NOTHING_TO_NOTE)('notes nothing for $name', async ({status, headers, offered}) => {
  const {cache, entries} = fakeCache()

  const hold = await noteAppBudgetAnswer({cache, response: answer(status, headers), offered})

  expect(hold).toBeUndefined()
  expect(entries.size).toBe(0)
})

test('treats a cache that throws as holding nothing, and still reports the verdict', async () => {
  const cache: ResponseCache = {
    match: async () => {
      throw new Error('cache unavailable')
    },
    put: async () => {
      throw new Error('cache unavailable')
    },
  }

  expect(await readAppBudgetHold({cache})).toBeUndefined()
  expect(await noteAppBudgetAnswer({cache, response: answer(401), offered: true})).toBe(
    'credentials-rejected',
  )
})
