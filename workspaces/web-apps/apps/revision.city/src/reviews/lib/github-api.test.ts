import {expect, test, vi} from 'vitest'
import {z} from 'zod'
import {
  createGitHubRequest,
  GitHubApiError,
  getPullRequest,
  listAllPages,
  listPullRequestFiles,
  repositoryPath,
} from './github-api'
import type {Fetch} from './openrouter'

const repository = {owner: 'acme', name: 'repo'}

test('createGitHubRequest sends the API headers, the token, and a JSON body', async () => {
  const fetchStub = vi.fn<Fetch>(async () => Response.json({id: 7}))
  const request = createGitHubRequest({token: async () => 'ghs_token', fetch: fetchStub})

  const result = await request({
    method: 'POST',
    path: '/repos/acme/repo/check-runs',
    body: {name: 'check'},
    schema: z.object({id: z.number()}),
  })

  expect(result).toEqual({id: 7})
  const [url, init] = fetchStub.mock.calls[0]
  expect(url).toBe('https://api.github.com/repos/acme/repo/check-runs')
  expect(init.method).toBe('POST')
  expect(init.body).toBe('{"name":"check"}')
  expect(Object.fromEntries(new Headers(init.headers))).toEqual({
    accept: 'application/vnd.github+json',
    authorization: 'Bearer ghs_token',
    'content-type': 'application/json',
    'user-agent': 'revision.city',
    'x-github-api-version': '2022-11-28',
  })
})

test('createGitHubRequest sends no token or body when it has none', async () => {
  const fetchStub = vi.fn<Fetch>(async () => Response.json({}))
  const request = createGitHubRequest({fetch: fetchStub})

  await request({path: '/zen', schema: z.object({})})

  const [, init] = fetchStub.mock.calls[0]
  expect(init.method).toBe('GET')
  expect(init.body).toBeUndefined()
  const headers = new Headers(init.headers)
  expect(headers.has('authorization')).toBe(false)
  expect(headers.has('content-type')).toBe(false)
})

test('createGitHubRequest throws an error with the status for a failed request', async () => {
  const request = createGitHubRequest({
    fetch: async () => new Response('{"message":"Validation Failed"}', {status: 422}),
  })

  const error = await request({path: '/x', schema: z.object({})}).catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(GitHubApiError)
  expect(error).toMatchObject({
    status: 422,
    message: 'GitHub returned 422 for GET /x: {"message":"Validation Failed"}',
  })
})

test('repositoryPath encodes the owner and name', () => {
  expect(repositoryPath({owner: 'a b', name: 'c/d'})).toBe('/repos/a%20b/c%2Fd')
})

test('listAllPages follows pages until a short page', async () => {
  const fetchStub = vi.fn<Fetch>(async (url) => {
    const page = Number(new URL(url).searchParams.get('page'))
    return Response.json(Array.from({length: page === 1 ? 100 : 3}, (_, index) => index))
  })

  const items = await listAllPages({
    request: createGitHubRequest({fetch: fetchStub}),
    path: '/items?state=all',
    schema: z.number(),
    maxPages: 5,
  })

  expect(items).toHaveLength(103)
  expect(fetchStub.mock.calls.map(([url]) => url)).toEqual([
    'https://api.github.com/items?state=all&per_page=100&page=1',
    'https://api.github.com/items?state=all&per_page=100&page=2',
  ])
})

test('listAllPages stops at the page limit', async () => {
  const fetchStub = vi.fn<Fetch>(async () => Response.json(Array.from({length: 100}, () => 1)))

  const items = await listAllPages({
    request: createGitHubRequest({fetch: fetchStub}),
    path: '/items',
    schema: z.number(),
    maxPages: 2,
  })

  expect(items).toHaveLength(200)
  expect(fetchStub.mock.calls[0][0]).toBe('https://api.github.com/items?per_page=100&page=1')
})

test('getPullRequest returns whether the pull request is open and its head', async () => {
  const fetchStub = vi.fn<Fetch>(async () =>
    Response.json({state: 'closed', head: {sha: 'abc'}, title: 'x'}),
  )

  const pull = await getPullRequest({
    request: createGitHubRequest({fetch: fetchStub}),
    repository,
    pullNumber: 7,
  })

  expect(pull).toEqual({open: false, headSha: 'abc'})
  expect(fetchStub.mock.calls[0][0]).toBe('https://api.github.com/repos/acme/repo/pulls/7')
})

test('listPullRequestFiles renames filename to path', async () => {
  const fetchStub = vi.fn<Fetch>(async () =>
    Response.json([
      {filename: 'a.ts', status: 'modified', patch: '@@ -1 +1 @@\n+a', additions: 1},
      {filename: 'b.png', status: 'added'},
    ]),
  )

  const files = await listPullRequestFiles({
    request: createGitHubRequest({fetch: fetchStub}),
    repository,
    pullNumber: 7,
  })

  expect(files).toEqual([
    {path: 'a.ts', status: 'modified', patch: '@@ -1 +1 @@\n+a'},
    {path: 'b.png', status: 'added', patch: undefined},
  ])
  expect(fetchStub.mock.calls[0][0]).toBe(
    'https://api.github.com/repos/acme/repo/pulls/7/files?per_page=100&page=1',
  )
})
