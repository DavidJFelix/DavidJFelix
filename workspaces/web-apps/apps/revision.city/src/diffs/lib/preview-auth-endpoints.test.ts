import {expect, test, vi} from 'vitest'

import {
  handlePreviewBrokerAuthorize,
  handlePreviewBrokerRedeem,
  handlePreviewSignInCallback,
  handlePreviewSignInStart,
  shouldBrokerSignIn,
} from './preview-auth-endpoints'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const PREVIEW = 'https://pr-409-revision-city.nullserve.workers.dev'
const BROKER = 'https://dev.revision.city'
// 32 zero bytes, base64: a valid AES-GCM key shape for the broker.
const HANDOFF_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const CONFIG = {brokerURL: BROKER, handoffKey: HANDOFF_KEY}

function readCookie(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie().find((header) => header.startsWith(`${name}=`))
}

test.each([
  {case: 'a preview host with a broker', url: PREVIEW, config: {brokerURL: BROKER}, expected: true},
  {
    case: 'production, which runs its own OAuth',
    url: 'https://revision.city',
    config: {brokerURL: BROKER},
    expected: false,
  },
  {case: 'a preview with no broker configured', url: PREVIEW, config: {}, expected: false},
])('brokers sign-in for $case: $expected', ({url, config, expected}) => {
  expect(shouldBrokerSignIn(new Request(`${url}/api/auth/github/login`), config)).toBe(expected)
})

test('start sends the challenge to the broker and keeps the verifier here', async () => {
  const response = await handlePreviewSignInStart(
    new Request(`${PREVIEW}/api/auth/github/preview-start?returnTo=/diffs/o/r/pull/1`),
    CONFIG,
  )

  const location = new URL(response.headers.get('location') ?? '')
  expect(location.origin).toBe(BROKER)
  expect(location.pathname).toBe('/api/auth/github/preview-authorize')
  expect(location.searchParams.get('origin')).toBe(PREVIEW)
  // The hash travels; the verifier that redeems it must not.
  const challenge = location.searchParams.get('challenge') ?? ''
  expect(challenge).not.toBe('')
  const verifierCookie = readCookie(response, 'diffs-preview-verifier') ?? ''
  expect(verifierCookie).toContain('HttpOnly')
  expect(location.search).not.toContain(verifierCookie.split('=')[1]?.split(';')[0] ?? 'unset')
})

test('start refuses to run on a non-preview origin', async () => {
  const response = await handlePreviewSignInStart(
    new Request('https://revision.city/api/auth/github/preview-start'),
    CONFIG,
  )

  expect(response.status).toBe(404)
})

test.each([
  ['another site entirely', 'https://evil.example.com'],
  ['a look-alike host', 'https://pr-409-revision-city.nullserve.workers.dev.evil.com'],
  ['plain http', 'http://pr-409-revision-city.nullserve.workers.dev'],
  ['no origin at all', null],
])('the broker refuses to seal for %s', async (_case, origin) => {
  const url = new URL(`${BROKER}/api/auth/github/preview-authorize`)
  if (origin !== null) {
    url.searchParams.set('origin', origin)
  }
  url.searchParams.set('challenge', 'some-challenge')

  const response = await handlePreviewBrokerAuthorize(new Request(url), CONFIG)

  expect(response.status).toBe(400)
})

test('the broker sends an unauthenticated visitor through its own sign-in first', async () => {
  const url = new URL(`${BROKER}/api/auth/github/preview-authorize`)
  url.searchParams.set('origin', PREVIEW)
  url.searchParams.set('challenge', 'some-challenge')

  const response = await handlePreviewBrokerAuthorize(new Request(url), CONFIG)

  const location = new URL(response.headers.get('location') ?? '')
  expect(location.pathname).toBe('/api/auth/github/login')
  // And returns here afterwards, so the visitor lands on the preview.
  expect(location.searchParams.get('returnTo')).toContain('/api/auth/github/preview-authorize')
})

test('a request with no broker key is not a broker', async () => {
  const url = new URL(`${BROKER}/api/auth/github/preview-authorize`)
  url.searchParams.set('origin', PREVIEW)
  url.searchParams.set('challenge', 'c')

  const response = await handlePreviewBrokerAuthorize(new Request(url), {brokerURL: BROKER})

  expect(response.status).toBe(404)
})

test.each([
  ['a body that is not JSON', 'nonsense'],
  ['a body with no verifier', JSON.stringify({handoff: 'v1.aa.bb'})],
  ['a body with no handoff', JSON.stringify({verifier: 'abc'})],
])('redeem rejects %s', async (_case, body) => {
  const response = await handlePreviewBrokerRedeem(
    new Request(`${BROKER}/api/auth/github/preview-redeem`, {method: 'POST', body}),
    CONFIG,
  )

  expect(response.status).toBe(400)
})

test('redeem answers the same way for a forged handoff as for a stale one', async () => {
  const forge = async (handoff: string) => {
    const response = await handlePreviewBrokerRedeem(
      new Request(`${BROKER}/api/auth/github/preview-redeem`, {
        method: 'POST',
        body: JSON.stringify({handoff, verifier: 'whatever'}),
      }),
      CONFIG,
    )
    return {status: response.status, body: await response.json()}
  }

  const forged = await forge('v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA')
  const malformed = await forge('not-even-a-handoff')

  expect(forged).toEqual(malformed)
})

test('the callback refuses a handoff with no verifier cookie', async () => {
  const response = await handlePreviewSignInCallback(
    new Request(`${PREVIEW}/api/auth/github/preview-callback?handoff=v1.aa.bb`),
    CONFIG,
  )

  expect(response.status).toBe(400)
})

test('the callback signs in and returns to where the visitor started', async () => {
  const start = await handlePreviewSignInStart(
    new Request(`${PREVIEW}/api/auth/github/preview-start?returnTo=/diffs/o/r/pull/1`),
    CONFIG,
  )
  const cookie = (readCookie(start, 'diffs-preview-verifier') ?? '').split(';')[0] ?? ''
  const fetcher = vi.fn<FetchLike>(async () =>
    Response.json({session: {accessToken: 'ghu_from_broker', login: 'e2e-user'}}),
  )

  const response = await handlePreviewSignInCallback(
    new Request(`${PREVIEW}/api/auth/github/preview-callback?handoff=v1.aa.bb`, {
      headers: {cookie},
    }),
    CONFIG,
    fetcher,
  )

  expect(response.headers.get('location')).toBe('/diffs/o/r/pull/1')
  expect(readCookie(response, 'diffs-github-auth')).toBeDefined()
  // Redeemed server-to-server, so the token never rides in a URL.
  const [, init] = fetcher.mock.calls[0] ?? []
  expect(init?.method).toBe('POST')
  expect(String(init?.body)).toContain('verifier')
})

test('the callback refuses when the broker will not redeem', async () => {
  const start = await handlePreviewSignInStart(
    new Request(`${PREVIEW}/api/auth/github/preview-start`),
    CONFIG,
  )
  const cookie = (readCookie(start, 'diffs-preview-verifier') ?? '').split(';')[0] ?? ''

  const response = await handlePreviewSignInCallback(
    new Request(`${PREVIEW}/api/auth/github/preview-callback?handoff=v1.aa.bb`, {
      headers: {cookie},
    }),
    CONFIG,
    vi.fn<FetchLike>(async () => Response.json({error: 'nope'}, {status: 400})),
  )

  expect(response.status).toBe(400)
  expect(readCookie(response, 'diffs-github-auth')).toBeUndefined()
})
