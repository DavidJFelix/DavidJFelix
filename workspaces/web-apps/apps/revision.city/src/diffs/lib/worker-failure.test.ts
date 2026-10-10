import {expect, test, vi} from 'vitest'

import {describeWorkerFailure} from './worker-failure'

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
    outcome: String.raw`returned 200 \(text/javascript, 25 bytes\)`,
  },
  {
    name: 'an error status with its content type',
    refetch: async () =>
      new Response('Not Found', {status: 404, headers: {'content-type': 'text/plain'}}),
    outcome: String.raw`returned 404 \(text/plain, 9 bytes\)`,
  },
  {
    name: 'an error status without a content type',
    refetch: async () => new Response(null, {status: 503}),
    outcome: String.raw`returned 503 \(no content type, 0 bytes\)`,
  },
  {
    name: 'a network error',
    refetch: async () => {
      throw new TypeError('Failed to fetch')
    },
    outcome: 'failed with TypeError: Failed to fetch',
  },
])(
  'a script load failure reports $name from a refetch of the script',
  async ({refetch, outcome}) => {
    const fetchImpl = vi.fn<FetchLike>(refetch)

    const description = await describeWorkerFailure({
      event: new Event('error'),
      scriptUrl: SCRIPT_URL,
      fetch: fetchImpl,
    })

    expect(description).toMatch(
      new RegExp(
        String.raw`^The diffs worker script failed to load, and a refetch of /assets/worker-abc\.js ${outcome}\. ${PAGE_CONTEXT}$`,
      ),
    )
    expect(fetchImpl).toHaveBeenCalledWith(SCRIPT_URL, expect.objectContaining({cache: 'reload'}))
  },
)

test('an uncaught error reports its message and location without a refetch', async () => {
  const fetchImpl = vi.fn<FetchLike>()
  const event = new ErrorEvent('error', {
    message: 'Uncaught SyntaxError: Unexpected token <',
    filename: 'https://revision.city/assets/worker-abc.js',
    lineno: 1,
    colno: 7,
  })

  const description = await describeWorkerFailure({event, scriptUrl: SCRIPT_URL, fetch: fetchImpl})

  expect(description).toMatch(
    new RegExp(
      String.raw`^The diffs worker threw at https://revision\.city/assets/worker-abc\.js:1:7: Uncaught SyntaxError: Unexpected token <\. ${PAGE_CONTEXT}$`,
    ),
  )
  expect(fetchImpl).not.toHaveBeenCalled()
})
