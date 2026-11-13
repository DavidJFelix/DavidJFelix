import {expect, test, vi} from 'vitest'

import {
  chooseWorkerRecovery,
  describeWorkerLoadFailure,
  describeWorkerThrow,
  reloadWorkerScript,
  type WorkerScriptReload,
} from './worker-failure'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const SCRIPT_URL = '/assets/worker-abc.js'
const PAGE_CONTEXT = String.raw`The page was open for \d+ s, and navigator\.onLine is true\.`

test.each([
  {
    name: 'a success status with the size of the script it read',
    refetch: async () =>
      new Response('self.onmessage = () => {}', {
        status: 200,
        headers: {'content-type': 'text/javascript'},
      }),
    reload: {kind: 'response', status: 200, contentType: 'text/javascript', byteLength: 25},
  },
  {
    name: 'an error status without a content type',
    refetch: async () => new Response(null, {status: 503}),
    reload: {kind: 'response', status: 503, contentType: null, byteLength: 0},
  },
  {
    name: 'a network error',
    refetch: async () => {
      throw new TypeError('Failed to fetch')
    },
    reload: {kind: 'network-error', message: 'TypeError: Failed to fetch'},
  },
])('a reload of the worker script gives $name', async ({refetch, reload}) => {
  const fetchImpl = vi.fn<FetchLike>(refetch)

  const result = await reloadWorkerScript({scriptUrl: SCRIPT_URL, fetch: fetchImpl})

  expect(result).toEqual(reload)
  expect(fetchImpl).toHaveBeenCalledWith(SCRIPT_URL, expect.objectContaining({cache: 'reload'}))
})

test.each<{name: string; reload: WorkerScriptReload; recovery: string}>([
  {
    name: 'a complete script restarts the pool',
    reload: {kind: 'response', status: 200, contentType: 'text/javascript', byteLength: 25},
    recovery: 'retry-pool',
  },
  {
    name: 'a missing script reloads the page',
    reload: {kind: 'response', status: 404, contentType: 'text/html', byteLength: 9},
    recovery: 'reload-page',
  },
  {
    name: 'a server error does nothing',
    reload: {kind: 'response', status: 503, contentType: null, byteLength: 0},
    recovery: 'none',
  },
  {
    name: 'a network error does nothing',
    reload: {kind: 'network-error', message: 'TypeError: Failed to fetch'},
    recovery: 'none',
  },
])('$name', ({reload, recovery}) => {
  expect(chooseWorkerRecovery(reload)).toBe(recovery)
})

test.each([
  {
    name: 'a response, and the restart of the pool',
    reload: {kind: 'response', status: 200, contentType: 'text/javascript', byteLength: 25},
    recovery: 'retry-pool',
    outcome: String.raw`returned 200 \(text/javascript, 25 bytes\)\. ${PAGE_CONTEXT} The page starts the worker pool again\.`,
  },
  {
    name: 'a response without a content type, and the page reload',
    reload: {kind: 'response', status: 404, contentType: null, byteLength: 9},
    recovery: 'reload-page',
    outcome: String.raw`returned 404 \(no content type, 9 bytes\)\. ${PAGE_CONTEXT} The page reloads once to get the current deploy\.`,
  },
  {
    name: 'a network error, and no recovery',
    reload: {kind: 'network-error', message: 'TypeError: Failed to fetch'},
    recovery: 'none',
    outcome: String.raw`failed with TypeError: Failed to fetch\. ${PAGE_CONTEXT}`,
  },
] as const)('a load failure report gives $name', ({reload, recovery, outcome}) => {
  const description = describeWorkerLoadFailure({scriptUrl: SCRIPT_URL, reload, recovery})

  expect(description).toMatch(
    new RegExp(
      String.raw`^The diffs worker script failed to load, and a refetch of /assets/worker-abc\.js ${outcome}$`,
    ),
  )
})

test('an uncaught error reports its message and location', () => {
  const event = new ErrorEvent('error', {
    message: 'Uncaught SyntaxError: Unexpected token <',
    filename: 'https://revision.city/assets/worker-abc.js',
    lineno: 1,
    colno: 7,
  })

  const description = describeWorkerThrow(event)

  expect(description).toMatch(
    new RegExp(
      String.raw`^The diffs worker threw at https://revision\.city/assets/worker-abc\.js:1:7: Uncaught SyntaxError: Unexpected token <\. ${PAGE_CONTEXT}$`,
    ),
  )
})
