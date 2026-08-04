import {expect, test, vi} from 'vitest'

import {
  handleGitHubAuthConfigRequest,
  handleGitHubLoginRequest,
  handleGitHubLogoutRequest,
  handleGitHubManageAccessRequest,
  handleGitHubOAuthCallbackRequest,
  handleGitHubSessionRequest,
  resolveGitHubAuth,
  withSetCookieHeaders,
} from './github-auth'

const ORIGIN = 'https://revision.city'
const CREDENTIALS = {clientId: 'Iv1.test-client', clientSecret: 'shh-secret'}

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a plain stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, {status})

// Stands in for GitHub's token + user endpoints during the callback flow.
const stubGitHubFetch = (overrides: {token?: unknown; user?: unknown; tokenStatus?: number} = {}) =>
  vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      return jsonResponse(
        overrides.token ?? {access_token: 'ghu_token', token_type: 'bearer'},
        overrides.tokenStatus ?? 200,
      )
    }
    if (url.startsWith('https://api.github.com/user')) {
      return jsonResponse(
        overrides.user ?? {login: 'test-user', avatar_url: 'https://a.test/i.png'},
      )
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })

const getSetCookies = (response: Response): string[] => response.headers.getSetCookie()

const cookiePair = (setCookie: string): string => setCookie.split(';', 1)[0] ?? ''

// Runs login then callback and returns the session Set-Cookie so other tests
// can exercise cookie-bearing requests through the real flow.
async function signIn(
  fetchImpl = stubGitHubFetch(),
): Promise<{sessionCookie: string; callbackResponse: Response}> {
  const login = handleGitHubLoginRequest(
    new Request(`${ORIGIN}/api/auth/github/login?returnTo=/diffs/o/r/pull/1`),
    {credentials: CREDENTIALS},
  )
  const stateCookie = cookiePair(getSetCookies(login)[0] ?? '')
  const state = new URL(login.headers.get('location') ?? '').searchParams.get('state')

  const callbackResponse = await handleGitHubOAuthCallbackRequest(
    new Request(`${ORIGIN}/api/auth/github/callback?code=abc&state=${state}`, {
      headers: {cookie: stateCookie},
    }),
    {credentials: CREDENTIALS, fetch: fetchImpl},
  )
  const sessionCookie = getSetCookies(callbackResponse)
    .map(cookiePair)
    .find((pair) => pair.startsWith('diffs-github-auth=') && !pair.endsWith('='))
  return {sessionCookie: sessionCookie ?? '', callbackResponse}
}

test('login redirects to GitHub authorize with client id, callback URL, and a state cookie', () => {
  const response = handleGitHubLoginRequest(
    new Request(`${ORIGIN}/api/auth/github/login?returnTo=/diffs/o/r/pull/1`),
    {credentials: CREDENTIALS},
  )

  expect(response.status).toBe(302)
  const location = new URL(response.headers.get('location') ?? '')
  expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
  expect(location.searchParams.get('client_id')).toBe(CREDENTIALS.clientId)
  expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/github/callback`)
  expect(location.searchParams.get('state')).toBeTruthy()

  const [stateCookie] = getSetCookies(response)
  expect(stateCookie).toContain('diffs-github-oauth-state=')
  expect(stateCookie).toContain('HttpOnly')
  expect(stateCookie).toContain('SameSite=Lax')
  expect(stateCookie).toContain('Secure')
  expect(stateCookie).toContain('Path=/')
})

test('login omits Secure on plain-HTTP local dev', () => {
  const response = handleGitHubLoginRequest(
    new Request('http://localhost:3005/api/auth/github/login'),
    {credentials: CREDENTIALS},
  )
  expect(getSetCookies(response)[0]).not.toContain('Secure')
})

test('login returns 503 when the app credentials are not configured', () => {
  const response = handleGitHubLoginRequest(new Request(`${ORIGIN}/api/auth/github/login`), {
    credentials: undefined,
  })
  expect(response.status).toBe(503)
})

test('callback exchanges the code, stores the session cookie, and returns to the diff', async () => {
  const fetchImpl = stubGitHubFetch()
  const {sessionCookie, callbackResponse} = await signIn(fetchImpl)

  expect(callbackResponse.status).toBe(302)
  expect(callbackResponse.headers.get('location')).toBe('/diffs/o/r/pull/1')
  expect(sessionCookie).not.toBe('')
  // The state cookie is cleared alongside setting the session.
  expect(
    getSetCookies(callbackResponse).some((cookie) =>
      cookie.startsWith('diffs-github-oauth-state=;'),
    ),
  ).toBe(true)

  const exchangeCall = fetchImpl.mock.calls[0]
  expect(String(exchangeCall?.[0])).toBe('https://github.com/login/oauth/access_token')
  const body = exchangeCall?.[1]?.body as URLSearchParams
  expect(body.get('client_id')).toBe(CREDENTIALS.clientId)
  expect(body.get('client_secret')).toBe(CREDENTIALS.clientSecret)
  expect(body.get('code')).toBe('abc')
})

test('callback rejects a state mismatch without setting a session', async () => {
  const login = handleGitHubLoginRequest(new Request(`${ORIGIN}/api/auth/github/login`), {
    credentials: CREDENTIALS,
  })
  const stateCookie = cookiePair(getSetCookies(login)[0] ?? '')

  const response = await handleGitHubOAuthCallbackRequest(
    new Request(`${ORIGIN}/api/auth/github/callback?code=abc&state=forged`, {
      headers: {cookie: stateCookie},
    }),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )

  expect(response.status).toBe(400)
  expect(getSetCookies(response).some((c) => c.startsWith('diffs-github-auth='))).toBe(false)
})

test('post-install callback redirects a signed-in visitor back without exchanging the code', async () => {
  const {sessionCookie} = await signIn()
  const setupFetch = stubGitHubFetch()

  const response = await handleGitHubOAuthCallbackRequest(
    new Request(
      `${ORIGIN}/api/auth/github/callback?code=unverified&installation_id=149599025&setup_action=install`,
      {headers: {cookie: sessionCookie}},
    ),
    {credentials: CREDENTIALS, fetch: setupFetch},
  )

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/diffs')
  // The code arrived without a state bound to this browser, so it is never
  // sent to GitHub's token endpoint.
  expect(setupFetch).not.toHaveBeenCalled()
})

test('post-install callback keeps the return path from a pending state cookie', async () => {
  const login = handleGitHubLoginRequest(
    new Request(`${ORIGIN}/api/auth/github/login?returnTo=/diffs/o/r/pull/1`),
    {credentials: CREDENTIALS},
  )
  const stateCookie = cookiePair(getSetCookies(login)[0] ?? '')
  const {sessionCookie} = await signIn()

  const response = await handleGitHubOAuthCallbackRequest(
    new Request(`${ORIGIN}/api/auth/github/callback?code=unverified&setup_action=update`, {
      headers: {cookie: `${sessionCookie}; ${stateCookie}`},
    }),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/diffs/o/r/pull/1')
})

test('post-install callback starts a state-bound sign-in for a signed-out visitor', async () => {
  const response = await handleGitHubOAuthCallbackRequest(
    new Request(
      `${ORIGIN}/api/auth/github/callback?code=unverified&installation_id=149599025&setup_action=install`,
    ),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )

  expect(response.status).toBe(302)
  const location = new URL(response.headers.get('location') ?? '')
  expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
  expect(location.searchParams.get('state')).toBeTruthy()
  // The fresh state cookie survives: nothing appended after it clears it.
  const stateCookies = getSetCookies(response).filter((cookie) =>
    cookie.startsWith('diffs-github-oauth-state='),
  )
  expect(stateCookies).toHaveLength(1)
  expect(stateCookies[0]).not.toContain('diffs-github-oauth-state=;')
})

test('callback with a GitHub error param returns to the diff signed out', async () => {
  const response = await handleGitHubOAuthCallbackRequest(
    new Request(`${ORIGIN}/api/auth/github/callback?error=access_denied`),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )
  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/diffs')
  expect(getSetCookies(response).some((c) => c.startsWith('diffs-github-auth='))).toBe(false)
})

test('callback surfaces a token-exchange error response as a 502', async () => {
  const {callbackResponse} = await signIn(
    stubGitHubFetch({token: {error: 'bad_verification_code'}}),
  )
  expect(callbackResponse.status).toBe(502)
})

test('session reports the signed-in login without exposing the token', async () => {
  const {sessionCookie} = await signIn()
  const response = await handleGitHubSessionRequest(
    new Request(`${ORIGIN}/api/auth/github/session`, {headers: {cookie: sessionCookie}}),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )

  const data = (await response.json()) as Record<string, unknown>
  expect(data).toEqual({
    authenticated: true,
    login: 'test-user',
    avatarUrl: 'https://a.test/i.png',
  })
  expect(JSON.stringify(data)).not.toContain('ghu_token')
})

test('session reports anonymous without a cookie', async () => {
  const response = await handleGitHubSessionRequest(
    new Request(`${ORIGIN}/api/auth/github/session`),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )
  expect(await response.json()).toEqual({authenticated: false})
})

test('logout clears the session cookie and returns to the diff', () => {
  const response = handleGitHubLogoutRequest(
    new Request(`${ORIGIN}/api/auth/github/logout?returnTo=/diffs/o/r/pull/1`),
  )
  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/diffs/o/r/pull/1')
  const [cleared] = getSetCookies(response)
  expect(cleared).toContain('diffs-github-auth=;')
  expect(cleared).toContain('Max-Age=0')
})

test('resolveGitHubAuth returns the access token for a non-expiring session', async () => {
  const {sessionCookie} = await signIn()
  const auth = await resolveGitHubAuth(
    new Request(`${ORIGIN}/api/diffs/diff`, {headers: {cookie: sessionCookie}}),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )
  expect(auth.session?.accessToken).toBe('ghu_token')
  expect(auth.setCookieHeaders).toEqual([])
})

test('resolveGitHubAuth refreshes an expired token and re-issues the cookie', async () => {
  const {sessionCookie} = await signIn(
    stubGitHubFetch({
      token: {
        access_token: 'ghu_old',
        expires_in: 1,
        refresh_token: 'ghr_refresh',
        refresh_token_expires_in: 15_811_200,
      },
    }),
  )

  const refreshFetch = stubGitHubFetch({
    token: {access_token: 'ghu_new', expires_in: 28_800, refresh_token: 'ghr_next'},
  })
  const auth = await resolveGitHubAuth(
    new Request(`${ORIGIN}/api/diffs/diff`, {headers: {cookie: sessionCookie}}),
    {credentials: CREDENTIALS, fetch: refreshFetch},
  )

  expect(auth.session?.accessToken).toBe('ghu_new')
  expect(auth.setCookieHeaders[0]).toContain('diffs-github-auth=')
  const body = refreshFetch.mock.calls[0]?.[1]?.body as URLSearchParams
  expect(body.get('grant_type')).toBe('refresh_token')
  expect(body.get('refresh_token')).toBe('ghr_refresh')
})

test('resolveGitHubAuth drops the session when the refresh fails', async () => {
  const {sessionCookie} = await signIn(
    stubGitHubFetch({
      token: {access_token: 'ghu_old', expires_in: 1, refresh_token: 'ghr_refresh'},
    }),
  )

  const auth = await resolveGitHubAuth(
    new Request(`${ORIGIN}/api/diffs/diff`, {headers: {cookie: sessionCookie}}),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch({token: {error: 'bad_refresh_token'}})},
  )

  expect(auth.session).toBeUndefined()
  expect(auth.setCookieHeaders[0]).toContain('diffs-github-auth=;')
})

test('resolveGitHubAuth ignores a malformed cookie', async () => {
  const auth = await resolveGitHubAuth(
    new Request(`${ORIGIN}/api/diffs/diff`, {headers: {cookie: 'diffs-github-auth=not-json'}}),
    {credentials: CREDENTIALS, fetch: stubGitHubFetch()},
  )
  expect(auth.session).toBeUndefined()
})

test('unsafe returnTo values fall back to /diffs', () => {
  for (const returnTo of ['https://evil.test/x', '//evil.test/x', 'diffs', '/a\\b']) {
    const response = handleGitHubLogoutRequest(
      new Request(`${ORIGIN}/api/auth/github/logout?returnTo=${encodeURIComponent(returnTo)}`),
    )
    expect(response.headers.get('location')).toBe('/diffs')
  }
})

test('manage-access redirects a signed-in visitor to their installation on GitHub', async () => {
  const {sessionCookie} = await signIn()
  const response = await handleGitHubManageAccessRequest(
    new Request(`${ORIGIN}/api/auth/github/installations`, {headers: {cookie: sessionCookie}}),
    {
      credentials: CREDENTIALS,
      fetch: vi.fn<FetchLike>(async () =>
        jsonResponse({
          installations: [
            {
              id: 7,
              html_url: 'https://github.com/settings/installations/7',
              account: {login: 'test-user'},
            },
          ],
        }),
      ),
    },
  )

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('https://github.com/settings/installations/7')
})

test('manage-access starts the sign-in when there is no session to manage', async () => {
  const response = await handleGitHubManageAccessRequest(
    new Request(`${ORIGIN}/api/auth/github/installations?returnTo=/diffs/o/r/pull/1`),
    {credentials: CREDENTIALS},
  )

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toContain('https://github.com/login/oauth/authorize')
})

test('withSetCookieHeaders appends every cookie to the response', () => {
  const response = withSetCookieHeaders(new Response('ok'), ['a=1; Path=/', 'b=2; Path=/'])
  expect(getSetCookies(response)).toEqual(['a=1; Path=/', 'b=2; Path=/'])
})

test('config reports the callback URL this origin will ask GitHub for', () => {
  const response = handleGitHubAuthConfigRequest(
    new Request('https://pr-409-revision-city.nullserve.workers.dev/api/auth/github/config'),
    {credentials: CREDENTIALS},
  )

  expect(response.status).toBe(200)
  return expect(response.json()).resolves.toEqual({
    configured: true,
    callbackURL: 'https://pr-409-revision-city.nullserve.workers.dev/api/auth/github/callback',
  })
})

test('config reports missing credentials without inventing a failure', async () => {
  const response = handleGitHubAuthConfigRequest(new Request(`${ORIGIN}/api/auth/github/config`), {
    credentials: undefined,
  })

  await expect(response.json()).resolves.toMatchObject({configured: false})
})

test('config never returns a credential value', async () => {
  const response = handleGitHubAuthConfigRequest(new Request(`${ORIGIN}/api/auth/github/config`), {
    credentials: CREDENTIALS,
  })

  expect(await response.text()).not.toContain(CREDENTIALS.clientSecret)
})
