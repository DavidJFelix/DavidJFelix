import {expect, test, vi} from 'vitest'

import {handleInboxListRequest, type InboxListBody} from './inbox-list'

const INBOX_URL = 'https://revision.city/api/inbox'
const SEARCH_BASE_QUERY = 'is:pr is:open archived:false '
const TOKEN_URL = 'https://github.com/login/oauth/access_token'

// fetch by call signature only: lib.dom types `typeof fetch` with a required static `preconnect`,
// which a plain stub cannot satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const sessionCookie = (session: Record<string, unknown>): string =>
  `diffs-github-auth=${encodeURIComponent(JSON.stringify({login: 'test-user', ...session}))}`

// No expiry, so the sign-in check never asks GitHub for a new token.
const SESSION_COOKIE = sessionCookie({accessToken: 'ghu_token'})
const EXPIRED_SESSION_COOKIE = sessionCookie({
  accessToken: 'ghu_old',
  accessTokenExpiresAt: 0,
  refreshToken: 'ghr_refresh',
})

const searchItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  number: 1,
  title: 'Fix the widget',
  updated_at: '2026-11-18T10:00:00Z',
  draft: false,
  user: {login: 'someone'},
  assignees: [],
  repository_url: 'https://api.github.com/repos/test-user/widgets',
  ...overrides,
})

const searchPage = (...items: Record<string, unknown>[]) => ({total_count: items.length, items})

interface GitHubStub {
  // Search answers by the qualifiers that follow the shared base query.
  searches?: Record<string, unknown>
  searchStatus?: number
  orgs?: unknown[]
  subscriptions?: unknown[]
  installations?: unknown[]
}

const inputHref = (input: Parameters<FetchLike>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

const stubGitHubFetch = (stub: GitHubStub = {}) =>
  vi.fn<FetchLike>(async (input) => {
    const href = inputHref(input)
    if (href === TOKEN_URL) {
      return Response.json({access_token: 'ghu_new', expires_in: 28_800})
    }
    const url = new URL(href)
    if (url.pathname === '/search/issues') {
      if (stub.searchStatus !== undefined) {
        return Response.json({message: 'blocked'}, {status: stub.searchStatus})
      }
      const qualifiers = (url.searchParams.get('q') ?? '').replace(SEARCH_BASE_QUERY, '')
      return Response.json(stub.searches?.[qualifiers] ?? searchPage())
    }
    const lists: Record<string, unknown> = {
      '/user/orgs': stub.orgs ?? [],
      '/user/subscriptions': stub.subscriptions ?? [],
      '/user/installations': {installations: stub.installations ?? []},
    }
    return Response.json(lists[url.pathname])
  })

const searchCount = (fetchImpl: ReturnType<typeof stubGitHubFetch>): number =>
  fetchImpl.mock.calls.filter(([input]) => new URL(inputHref(input)).pathname === '/search/issues')
    .length

const requestInbox = (fetchImpl: FetchLike, cookie = SESSION_COOKIE): Promise<Response> =>
  handleInboxListRequest(new Request(INBOX_URL, {headers: {cookie}}), {
    credentials: {clientId: 'client-id', clientSecret: 'client-secret'},
    fetch: fetchImpl,
  })

const readInbox = async (stub: GitHubStub): Promise<InboxListBody> => {
  const response = await requestInbox(stubGitHubFetch(stub))
  expect(response.status).toBe(200)
  const body: InboxListBody = await response.json()
  return body
}

test('a pull request from three searches comes one time with its reasons in the inbox order', async () => {
  const pullRequest = searchItem({
    number: 7,
    assignees: [{login: 'test-user'}],
    repository_url: 'https://api.github.com/repos/test-org/tools',
  })
  const {items} = await readInbox({
    orgs: [{login: 'test-org'}],
    installations: [{id: 1, account: {login: 'test-org'}, repository_selection: 'all'}],
    searches: {
      'org:test-org': searchPage(pullRequest),
      'assignee:@me': searchPage(pullRequest),
      'review-requested:@me': searchPage(pullRequest),
    },
  })

  expect(items).toEqual([
    {
      owner: 'test-org',
      repo: 'tools',
      number: 7,
      title: 'Fix the widget',
      author: 'someone',
      updatedAt: '2026-11-18T10:00:00Z',
      draft: false,
      assignees: ['test-user'],
      reasons: ['review-requested', 'assigned', 'member'],
    },
  ])
})

test('a different letter case in the owner and the repository does not split a pull request', async () => {
  const {items} = await readInbox({
    searches: {
      'review-requested:@me': searchPage(
        searchItem({repository_url: 'https://api.github.com/repos/Test-User/Widgets'}),
      ),
      'user:@me': searchPage(searchItem()),
    },
  })

  expect(items.map((item) => item.reasons)).toEqual([['review-requested', 'owned']])
})

test('the newest update comes first and a pull request with no update time comes last', async () => {
  const {items} = await readInbox({
    searches: {
      'review-requested:@me': searchPage(searchItem({number: 1, updated_at: null})),
      'assignee:@me': searchPage(searchItem({number: 2, updated_at: '2026-11-01T10:00:00Z'})),
      'user:@me': searchPage(searchItem({number: 3, updated_at: '2026-11-18T10:00:00Z'})),
    },
  })

  expect(items.map((item) => item.number)).toEqual([3, 2, 1])
})

test.each<{name: string; stub: GitHubStub; truncated: boolean}>([
  {
    name: 'no search is cut',
    stub: {searches: {'review-requested:@me': searchPage(searchItem())}},
    truncated: false,
  },
  {
    name: 'GitHub has more review requests than the page gives',
    stub: {searches: {'review-requested:@me': {total_count: 21, items: [searchItem()]}}},
    truncated: true,
  },
  {
    name: 'GitHub has more assigned pull requests than the page gives',
    stub: {searches: {'assignee:@me': {total_count: 2, items: [searchItem()]}}},
    truncated: true,
  },
  {
    name: 'the list of watched repositories fills a full page',
    stub: {subscriptions: Array.from({length: 100}, (_, i) => ({full_name: `other/repo-${i}`}))},
    truncated: true,
  },
])('truncated is $truncated when $name', async ({stub, truncated}) => {
  expect((await readInbox(stub)).truncated).toBe(truncated)
})

test('a load with every search at its limit does 8 searches and is truncated', async () => {
  const orgLogins = Array.from({length: 40}, (_, i) => `organization-number-${i}`)
  const watchedOwners = Array.from({length: 40}, (_, i) => `owner-${i}`)
  const fetchImpl = stubGitHubFetch({
    orgs: orgLogins.map((login) => ({login})),
    subscriptions: watchedOwners.map((owner) => ({full_name: `${owner}/repository-name`})),
    installations: [...orgLogins, ...watchedOwners].map((login, id) => ({
      id,
      account: {login},
      repository_selection: 'all',
    })),
  })

  const response = await requestInbox(fetchImpl)

  expect(searchCount(fetchImpl)).toBe(8)
  expect(await response.json()).toEqual({items: [], truncated: true})
})

test.each<{name: string; searchStatus: number; status: number; reason?: string; wait?: string}>([
  {name: 'GitHub rejects the token', searchStatus: 401, status: 401, reason: 'sign-in-again'},
  {name: 'the search limit is spent', searchStatus: 429, status: 429, wait: '60'},
  {name: 'the search is unavailable', searchStatus: 500, status: 502},
])('answers $status when $name', async ({searchStatus, status, reason, wait}) => {
  const response = await requestInbox(stubGitHubFetch({searchStatus}))

  expect(response.status).toBe(status)
  expect(response.headers.get('Retry-After')).toBe(wait ?? null)
  const body: {reason?: string} = await response.json()
  expect(body.reason).toBe(reason)
})

test('answers 401 to a signed-out visitor before a request to GitHub', async () => {
  const fetchImpl = vi.fn<FetchLike>()
  vi.stubGlobal('fetch', fetchImpl)

  const response = await handleInboxListRequest(new Request(INBOX_URL))

  expect(response.status).toBe(401)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Vary')).toBe('Cookie')
  expect(fetchImpl).not.toHaveBeenCalled()
})

test.each<{stub: GitHubStub; status: number}>([
  {stub: {}, status: 200},
  {stub: {searchStatus: 500}, status: 502},
])('the $status answer is not cached and carries the refreshed session', async (row) => {
  const fetchImpl = stubGitHubFetch(row.stub)

  const response = await requestInbox(fetchImpl, EXPIRED_SESSION_COOKIE)

  expect(response.status).toBe(row.status)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Vary')).toBe('Cookie')
  expect(response.headers.getSetCookie()).toEqual([expect.stringContaining('ghu_new')])
  const searches = fetchImpl.mock.calls.filter(([input]) => inputHref(input) !== TOKEN_URL)
  for (const [, init] of searches) {
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ghu_new')
  }
})
