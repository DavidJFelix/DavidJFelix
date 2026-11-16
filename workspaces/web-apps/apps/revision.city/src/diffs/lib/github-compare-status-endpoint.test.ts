import {expect, test, vi} from 'vitest'

import {encodeCookiePayload} from './github-auth'
import {handleGitHubCompareStatusRequest} from './github-compare-status-endpoint'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const ORIGIN = 'https://revision.city'
const CREDENTIALS = {clientId: 'Iv1.test-client', clientSecret: 'test-secret'}
const COMPARE_PATH = '/owner/repo/compare/main...feature'
const SESSION_COOKIE = `diffs-github-auth=${encodeCookiePayload({accessToken: 'ghu_token', login: 'reviewer'})}`

function statusRequest(path: string | undefined, cookie?: string): Request {
  const query = path === undefined ? '' : `?${new URLSearchParams({path})}`
  return new Request(`${ORIGIN}/api/diffs/github-compare-status${query}`, {
    headers: cookie === undefined ? {} : {cookie},
  })
}

function requestURL(input: Parameters<FetchLike>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

// Answers the token refresh and the compare lookup, which gets `compareStatus`.
function stubGitHub({compareStatus = 200}: {compareStatus?: number} = {}) {
  return vi.fn<FetchLike>(async (input) => {
    const url = requestURL(input)
    if (url.includes('/login/oauth/access_token')) {
      return Response.json({access_token: 'ghu_new', expires_in: 28_800})
    }
    return Response.json({behind_by: 3}, {status: compareStatus})
  })
}

test('a request without a path is refused', async () => {
  const fetcher = stubGitHub()

  const response = await handleGitHubCompareStatusRequest(statusRequest(undefined), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

test('a signed-out request asks for a sign-in and does not call GitHub', async () => {
  const fetcher = stubGitHub()

  const response = await handleGitHubCompareStatusRequest(statusRequest(COMPARE_PATH), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(401)
  expect(fetcher).not.toHaveBeenCalled()
})

test('a signed-in compare request answers the count with the session token', async () => {
  const fetcher = stubGitHub()

  const response = await handleGitHubCompareStatusRequest(
    statusRequest(COMPARE_PATH, SESSION_COOKIE),
    {credentials: CREDENTIALS, fetch: fetcher},
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({behindBy: 3})
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
    'Bearer ghu_token',
  )
})

test('a path that is not a compare answers no count', async () => {
  const fetcher = stubGitHub()

  const response = await handleGitHubCompareStatusRequest(
    statusRequest('/owner/repo/pull/7', SESSION_COOKIE),
    {credentials: CREDENTIALS, fetch: fetcher},
  )

  expect(await response.json()).toEqual({behindBy: null})
  expect(fetcher).not.toHaveBeenCalled()
})

test('a GitHub failure answers with the loader status', async () => {
  const fetcher = stubGitHub({compareStatus: 404})

  const response = await handleGitHubCompareStatusRequest(
    statusRequest(COMPARE_PATH, SESSION_COOKIE),
    {credentials: CREDENTIALS, fetch: fetcher},
  )

  expect(response.status).toBe(404)
  expect(await response.json()).toHaveProperty('error')
})

test('a failure that is not an Error answers a generic message', async () => {
  const fetcher = vi.fn<FetchLike>(async () => {
    throw 'offline'
  })

  const response = await handleGitHubCompareStatusRequest(
    statusRequest(COMPARE_PATH, SESSION_COOKIE),
    {credentials: CREDENTIALS, fetch: fetcher},
  )

  expect(await response.json()).toEqual({error: 'Unknown error'})
})
