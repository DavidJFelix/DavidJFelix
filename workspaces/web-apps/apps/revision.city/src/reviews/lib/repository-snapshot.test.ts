import {expect, test, vi} from 'vitest'
import {createGitHubRequest} from './github-api'
import type {Fetch} from './openrouter'
import {loadRepositorySnapshot, readsStillMatch} from './repository-snapshot'

const repository = {owner: 'acme', name: 'repo'}

const tree = {
  sha: 'root-sha',
  truncated: false,
  tree: [
    {path: 'src', type: 'tree', sha: 'src-sha'},
    {path: 'src/a.ts', type: 'blob', sha: 'a-sha', size: 5},
    {path: 'vendor/lib', type: 'commit', sha: 'lib-sha'},
  ],
}

const githubStub = (responses: Record<string, () => Response>) =>
  vi.fn<Fetch>(async (url) => {
    const respond = responses[new URL(url).pathname]
    if (respond === undefined) {
      throw new Error(`Unexpected fetch: ${url}`)
    }
    return respond()
  })

const loadWith = (fetchStub: Fetch) =>
  loadRepositorySnapshot({
    request: createGitHubRequest({fetch: fetchStub}),
    repository,
    commitSha: 'head',
  })

test('loadRepositorySnapshot maps every path of the recursive tree, with the root as ""', async () => {
  const fetchStub = githubStub({'/repos/acme/repo/git/trees/head': () => Response.json(tree)})

  const snapshot = await loadWith(fetchStub)

  expect(Object.fromEntries(snapshot?.entries ?? [])).toEqual({
    '': {type: 'tree', sha: 'root-sha'},
    src: {type: 'tree', sha: 'src-sha'},
    'src/a.ts': {type: 'blob', sha: 'a-sha', sizeBytes: 5},
    'vendor/lib': {type: 'commit', sha: 'lib-sha'},
  })
  expect(fetchStub.mock.calls[0][0]).toBe(
    'https://api.github.com/repos/acme/repo/git/trees/head?recursive=1',
  )
})

test('loadRepositorySnapshot returns undefined for a truncated tree', async () => {
  const fetchStub = githubStub({
    '/repos/acme/repo/git/trees/head': () => Response.json({...tree, truncated: true}),
  })

  expect(await loadWith(fetchStub)).toBeUndefined()
})

test('readBlob decodes the base64 content and reads each blob once', async () => {
  const fetchStub = githubStub({
    '/repos/acme/repo/git/trees/head': () => Response.json(tree),
    '/repos/acme/repo/git/blobs/a-sha': () =>
      Response.json({content: `${btoa('hello')}\n`, encoding: 'base64'}),
  })
  const snapshot = await loadWith(fetchStub)

  const first = await snapshot?.readBlob('a-sha')
  const second = await snapshot?.readBlob('a-sha')

  expect(new TextDecoder().decode(first)).toBe('hello')
  expect(second).toBe(first)
  expect(fetchStub).toHaveBeenCalledTimes(2)
})

test('readBlob tries again after a failed read', async () => {
  let blobCalls = 0
  const fetchStub = githubStub({
    '/repos/acme/repo/git/trees/head': () => Response.json(tree),
    '/repos/acme/repo/git/blobs/a-sha': () => {
      blobCalls += 1
      return blobCalls === 1
        ? new Response('unavailable', {status: 502})
        : Response.json({content: btoa('hello'), encoding: 'base64'})
    },
  })
  const snapshot = await loadWith(fetchStub)

  await expect(snapshot?.readBlob('a-sha')).rejects.toThrow('GitHub returned 502')
  expect(new TextDecoder().decode(await snapshot?.readBlob('a-sha'))).toBe('hello')
})

const snapshot = {
  entries: new Map([
    ['', {type: 'tree' as const, sha: 'root'}],
    ['src/a.ts', {type: 'blob' as const, sha: 'a1'}],
  ]),
  readBlob: async () => new Uint8Array(),
}

test.each([
  {name: 'no reads', reads: [], expected: true},
  {name: 'an unchanged file', reads: [{path: 'src/a.ts', sha: 'a1'}], expected: true},
  {name: 'a changed file', reads: [{path: 'src/a.ts', sha: 'a0'}], expected: false},
  {name: 'a path that is still missing', reads: [{path: 'src/b.ts', sha: ''}], expected: true},
  {name: 'a missing path that now exists', reads: [{path: 'src/a.ts', sha: ''}], expected: false},
  {name: 'a file that is now gone', reads: [{path: 'src/b.ts', sha: 'b1'}], expected: false},
])('readsStillMatch is $expected for $name', ({reads, expected}) => {
  expect(readsStillMatch(reads, snapshot)).toBe(expected)
})

test('readsStillMatch is false for reads without a snapshot to check them against', () => {
  expect(readsStillMatch([{path: 'src/a.ts', sha: 'a1'}], undefined)).toBe(false)
  expect(readsStillMatch([], undefined)).toBe(true)
})
