import {expect, test, vi} from 'vitest'

import {handlePullRequestListRequest, type PullRequestGroup} from './github-pull-requests'

const ORIGIN = 'https://revision.city'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a plain stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

// A session cookie the auth layer accepts, hand-built the way the callback
// flow would store it. No expiry, so resolveGitHubAuth never refreshes.
const SESSION_COOKIE = `diffs-github-auth=${encodeURIComponent(
  JSON.stringify({accessToken: 'ghu_token', login: 'test-user'}),
)}`

const searchItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  number: 1,
  title: 'Fix the widget',
  updated_at: '2026-07-28T10:00:00Z',
  draft: false,
  user: {login: 'someone'},
  repository_url: 'https://api.github.com/repos/test-user/widgets',
  ...overrides,
})

interface GitHubStubOptions {
  searchByQualifier?: Record<string, unknown>
  orgs?: unknown
  orgsStatus?: number
  subscriptions?: unknown
  subscriptionsStatus?: number
  searchStatus?: number
}

// Stands in for GitHub's search, org, and subscription endpoints. Search
// responses are keyed by the qualifier that follows the shared base query.
const stubGitHubFetch = (options: GitHubStubOptions = {}) =>
  vi.fn<FetchLike>(async (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    if (url.pathname === '/user/orgs') {
      return Response.json(options.orgs ?? [], {status: options.orgsStatus ?? 200})
    }
    if (url.pathname === '/user/subscriptions') {
      return Response.json(options.subscriptions ?? [], {
        status: options.subscriptionsStatus ?? 200,
      })
    }
    if (url.pathname === '/search/issues') {
      if (options.searchStatus !== undefined) {
        return Response.json({message: 'rate limited'}, {status: options.searchStatus})
      }
      const qualifiers = (url.searchParams.get('q') ?? '')
        .replace('is:pr is:open archived:false ', '')
        .trim()
      const body = options.searchByQualifier?.[qualifiers] ?? {total_count: 0, items: []}
      return Response.json(body)
    }
    throw new Error(`Unexpected fetch: ${url.href}`)
  })

const listPullRequests = (fetchImpl: FetchLike): Promise<Response> =>
  handlePullRequestListRequest(
    new Request(`${ORIGIN}/api/diffs/pull-requests`, {headers: {cookie: SESSION_COOKIE}}),
    {fetch: fetchImpl},
  )

const readGroups = async (response: Response): Promise<PullRequestGroup[]> => {
  const data = (await response.json()) as {groups: PullRequestGroup[]}
  return data.groups
}

test('answers 401 without a session, before touching GitHub', async () => {
  const fetchImpl = stubGitHubFetch()
  const response = await handlePullRequestListRequest(
    new Request(`${ORIGIN}/api/diffs/pull-requests`),
    {fetch: fetchImpl},
  )

  expect(response.status).toBe(401)
  expect(fetchImpl).not.toHaveBeenCalled()
})

// One pull request per group: assigned in the visitor's own repo, two owned,
// one in a member org repo, one in a watched repo outside both.
const FOUR_GROUP_STUB: GitHubStubOptions = {
  orgs: [{login: 'test-org'}],
  subscriptions: [{full_name: 'other/watched-repo'}],
  searchByQualifier: {
    'assignee:@me': {
      total_count: 1,
      items: [searchItem({number: 7, title: 'Assigned one'})],
    },
    'user:@me': {
      total_count: 2,
      items: [
        searchItem({number: 8, title: 'Owned one', draft: true}),
        searchItem({
          number: 9,
          title: 'Owned two',
          repository_url: 'https://api.github.com/repos/test-user/gadgets',
        }),
      ],
    },
    'org:test-org': {
      total_count: 1,
      items: [
        searchItem({
          number: 10,
          title: 'Member one',
          repository_url: 'https://api.github.com/repos/test-org/tools',
        }),
      ],
    },
    'repo:other/watched-repo': {
      total_count: 1,
      items: [
        searchItem({
          number: 11,
          title: 'Watched one',
          repository_url: 'https://api.github.com/repos/other/watched-repo',
        }),
      ],
    },
  },
}

test('groups pull requests by assignment, ownership, membership, and watching', async () => {
  const response = await listPullRequests(stubGitHubFetch(FOUR_GROUP_STUB))
  expect(response.status).toBe(200)
  const groups = await readGroups(response)

  expect(groups.map((group) => group.kind)).toEqual(['assigned', 'owned', 'member', 'watched'])
  expect(groups[0]?.pullRequests).toEqual([
    {
      owner: 'test-user',
      repo: 'widgets',
      number: 7,
      title: 'Assigned one',
      author: 'someone',
      updatedAt: '2026-07-28T10:00:00Z',
      draft: false,
    },
  ])
  expect(groups[1]?.pullRequests.map((pr) => [pr.number, pr.draft])).toEqual([
    [8, true],
    [9, false],
  ])
  expect(groups[2]?.pullRequests.map((pr) => pr.number)).toEqual([10])
  expect(groups[3]?.pullRequests.map((pr) => pr.number)).toEqual([11])
  expect(groups[1]?.totalCount).toBe(2)
})

test('reports a pull request only under the first group that claims it', async () => {
  const assignedAndOwned = searchItem({number: 7, title: 'Both'})
  const fetchImpl = stubGitHubFetch({
    searchByQualifier: {
      'assignee:@me': {total_count: 1, items: [assignedAndOwned]},
      'user:@me': {total_count: 1, items: [assignedAndOwned]},
    },
  })

  const groups = await readGroups(await listPullRequests(fetchImpl))
  expect(groups[0]?.pullRequests.map((pr) => pr.number)).toEqual([7])
  expect(groups[1]?.pullRequests).toEqual([])
  // The count still reports what GitHub has, even when the row moved up.
  expect(groups[1]?.totalCount).toBe(1)
})

test('watched repositories already covered by ownership or membership are not searched again', async () => {
  const fetchImpl = stubGitHubFetch({
    orgs: [{login: 'test-org'}],
    subscriptions: [
      {full_name: 'test-user/widgets'},
      {full_name: 'Test-Org/tools'},
      {full_name: 'other/watched-repo'},
    ],
  })

  await listPullRequests(fetchImpl)

  const searchQueries = fetchImpl.mock.calls
    .map((call) => new URL(String(call[0])))
    .filter((url) => url.pathname === '/search/issues')
    .map((url) => url.searchParams.get('q'))
  expect(searchQueries).toContain('is:pr is:open archived:false repo:other/watched-repo')
  expect(searchQueries.some((query) => query?.includes('repo:test-user/widgets'))).toBe(false)
  expect(searchQueries.some((query) => query?.includes('repo:Test-Org/tools'))).toBe(false)
})

test('an app without org or watching visibility reports those groups empty', async () => {
  const fetchImpl = stubGitHubFetch({
    orgsStatus: 403,
    subscriptionsStatus: 403,
    searchByQualifier: {
      'assignee:@me': {total_count: 1, items: [searchItem({number: 7})]},
    },
  })

  const response = await listPullRequests(fetchImpl)
  expect(response.status).toBe(200)
  const groups = await readGroups(response)
  expect(groups[0]?.pullRequests.map((pr) => pr.number)).toEqual([7])
  expect(groups[2]).toEqual({kind: 'member', pullRequests: [], totalCount: 0})
  expect(groups[3]).toEqual({kind: 'watched', pullRequests: [], totalCount: 0})
})

test('a failing search answers 502 rather than an empty list', async () => {
  const response = await listPullRequests(stubGitHubFetch({searchStatus: 403}))
  expect(response.status).toBe(502)
})

test('searches carry the session token and never a client-supplied one', async () => {
  const fetchImpl = stubGitHubFetch()
  await listPullRequests(fetchImpl)

  for (const call of fetchImpl.mock.calls) {
    const headers = call[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ghu_token')
  }
})
