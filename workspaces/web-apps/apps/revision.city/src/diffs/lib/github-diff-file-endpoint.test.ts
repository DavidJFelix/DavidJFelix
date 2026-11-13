import {expect, test, vi} from 'vitest'

import {encodeCookiePayload} from './github-auth'
import {handleGitHubDiffFileRequest} from './github-diff-file-endpoint'
import {clearGitHubDiffFileServerCache} from './github-diff-file-server'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const ORIGIN = 'https://revision.city'
const CREDENTIALS = {clientId: 'Iv1.test-client', clientSecret: 'test-secret'}
const FILE_QUERY = 'path=/owner/repo/pull/7&name=src/a.ts&type=change'
const SESSION_COOKIE = `diffs-github-auth=${encodeCookiePayload({accessToken: 'ghu_token', login: 'reviewer'})}`

function fileRequest(query: string, cookie?: string): Request {
  return new Request(`${ORIGIN}/api/diffs/github-diff-file?${query}`, {
    headers: cookie === undefined ? {} : {cookie},
  })
}

function requestURL(input: Parameters<FetchLike>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

// Answers the token refresh, ref resolution and file reads. A pull request
// lookup answers `pullStatus`.
function stubGitHub({pullStatus = 200}: {pullStatus?: number} = {}) {
  return vi.fn<FetchLike>(async (input) => {
    const url = requestURL(input)
    if (url.includes('/login/oauth/access_token')) {
      return Response.json({access_token: 'ghu_new', expires_in: 28_800})
    }
    if (url.includes('/pulls/7')) {
      return Response.json(
        {
          base: {sha: 'base-sha', repo: {full_name: 'owner/repo'}},
          head: {sha: 'head-sha', repo: {full_name: 'owner/repo'}},
        },
        {status: pullStatus},
      )
    }
    if (url.includes('/compare/')) {
      return Response.json({merge_base_commit: {sha: 'merge-base-sha'}})
    }
    return new Response('export function greet() {}\n')
  })
}

function authorizationHeaders(fetcher: ReturnType<typeof stubGitHub>): (string | null)[] {
  return fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('authorization'))
}

test('a request without the file parameters is refused', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const response = await handleGitHubDiffFileRequest(fileRequest('path=/owner/repo/pull/7'), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

test('a signed-out request asks for a sign-in and does not call GitHub', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const response = await handleGitHubDiffFileRequest(fileRequest(FILE_QUERY), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(401)
  expect(fetcher).not.toHaveBeenCalled()
})

test('a signed-in read sends the session token and does not use the shared cache', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()
  const options = {credentials: CREDENTIALS, fetch: fetcher}

  const first = await handleGitHubDiffFileRequest(fileRequest(FILE_QUERY, SESSION_COOKIE), options)
  const callsForOneRead = fetcher.mock.calls.length
  await handleGitHubDiffFileRequest(fileRequest(FILE_QUERY, SESSION_COOKIE), options)

  expect(first.status).toBe(200)
  expect(await first.json()).toMatchObject({newFile: {contents: 'export function greet() {}\n'}})
  expect(authorizationHeaders(fetcher).every((header) => header === 'Bearer ghu_token')).toBe(true)
  expect(fetcher.mock.calls.length).toBe(callsForOneRead * 2)
})

test('a GitHub failure answers with the loader status', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub({pullStatus: 404})

  const response = await handleGitHubDiffFileRequest(fileRequest(FILE_QUERY, SESSION_COOKIE), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(404)
  expect(await response.json()).toHaveProperty('error')
})

test('a refreshed session cookie reaches the browser', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()
  const expiredCookie = `diffs-github-auth=${encodeCookiePayload({
    accessToken: 'ghu_old',
    accessTokenExpiresAt: Date.now() - 1000,
    refreshToken: 'ghr_refresh',
    login: 'reviewer',
  })}`

  const response = await handleGitHubDiffFileRequest(fileRequest(FILE_QUERY, expiredCookie), {
    credentials: CREDENTIALS,
    fetch: fetcher,
  })

  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toContain('diffs-github-auth=')
  expect(authorizationHeaders(fetcher)).toContain('Bearer ghu_new')
})
