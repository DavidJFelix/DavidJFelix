import {expect, test, vi} from 'vitest'

import {createCodebergFileReader, loadCodebergDiffFiles} from './codeberg-diff-file-server'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const API = 'https://codeberg.org/api/v1/repos/acme/widgets'
const PULL = '/acme/widgets/pulls/7'
const COMMIT = '/acme/widgets/commit/83fea5e'

// Answers ref lookups and file reads. A file read returns the ref and the path,
// so a test can see which revision of which file the loader read.
function stubCodeberg(parents: readonly {sha: string}[] = [{sha: 'parent-sha'}]) {
  return vi.fn<FetchLike>(async (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    if (url.href === `${API}/pulls/7`) {
      return Response.json({merge_base: 'merge-base-sha', head: {sha: 'head-sha'}})
    }
    if (url.href === `${API}/git/commits/83fea5e`) {
      return Response.json({sha: 'commit-sha', parents})
    }
    const rawPath = url.pathname.replace('/api/v1/repos/acme/widgets/raw/', '')
    if (rawPath === url.pathname) {
      return new Response('not found', {status: 404})
    }
    return new Response(`${url.searchParams.get('ref')}:${decodeURIComponent(rawPath)}`)
  })
}

test('reads a changed pull request file at the merge base and the head', async () => {
  const fetcher = stubCodeberg()

  const {oldFile, newFile} = await loadCodebergDiffFiles(
    {name: 'src/a.ts', path: PULL, type: 'change'},
    {fetch: fetcher},
  )

  expect(oldFile?.contents).toBe('merge-base-sha:src/a.ts')
  expect(newFile?.contents).toBe('head-sha:src/a.ts')
})

test('a reader looks up the revisions once for all its files', async () => {
  const fetcher = stubCodeberg()
  const readFiles = createCodebergFileReader(PULL, {fetch: fetcher})

  await Promise.all([
    readFiles({name: 'src/a.ts', type: 'change'}),
    readFiles({name: 'src/b.ts', type: 'change'}),
    readFiles({name: 'src/c.ts', type: 'new'}),
  ])

  const lookups = fetcher.mock.calls.filter(([input]) => input === `${API}/pulls/7`)
  expect(lookups).toHaveLength(1)
})

test('a reader looks up the revisions again after a failed lookup', async () => {
  const codeberg = stubCodeberg()
  let calls = 0
  const fetcher: FetchLike = async (input, init) => {
    calls += 1
    return calls === 1 ? new Response('', {status: 503}) : codeberg(input, init)
  }
  const readFiles = createCodebergFileReader(PULL, {fetch: fetcher})

  await expect(readFiles({name: 'src/a.ts', type: 'change'})).rejects.toThrow('(503)')
  const {newFile} = await readFiles({name: 'src/b.ts', type: 'change'})

  expect(newFile?.contents).toBe('head-sha:src/b.ts')
})

test('reads a renamed file at its old path on the old side', async () => {
  const fetcher = stubCodeberg()

  const {oldFile, newFile} = await loadCodebergDiffFiles(
    {name: 'src/b.ts', path: COMMIT, prevName: 'src/a.ts', type: 'rename-changed'},
    {fetch: fetcher},
  )

  expect(oldFile?.contents).toBe('parent-sha:src/a.ts')
  expect(newFile?.contents).toBe('commit-sha:src/b.ts')
})

test.each([
  {type: 'new', oldFile: null, newFile: 'commit-sha:src/a.ts'},
  {type: 'rename-pure', oldFile: null, newFile: 'commit-sha:src/a.ts'},
  {type: 'deleted', oldFile: 'parent-sha:src/a.ts', newFile: null},
] as const)('reads only one side of a $type file', async ({type, oldFile, newFile}) => {
  const files = await loadCodebergDiffFiles(
    {name: 'src/a.ts', path: COMMIT, type},
    {fetch: stubCodeberg()},
  )

  expect(files.oldFile?.contents ?? null).toBe(oldFile)
  expect(files.newFile?.contents ?? null).toBe(newFile)
})

test('sends no credentials, because Codeberg has no sign-in yet', async () => {
  const fetcher = stubCodeberg()

  await loadCodebergDiffFiles({name: 'src/a.ts', path: PULL, type: 'change'}, {fetch: fetcher})

  for (const [, init] of fetcher.mock.calls) {
    expect(new Headers(init?.headers).get('authorization')).toBeNull()
  }
})

test('encodes each path segment of the file', async () => {
  const fetcher = stubCodeberg()

  await loadCodebergDiffFiles({name: 'docs/a b#1.md', path: COMMIT, type: 'new'}, {fetch: fetcher})

  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(`${API}/raw/docs/a%20b%231.md?ref=commit-sha`)
})

test('a root commit has no old side to read', async () => {
  await expect(
    loadCodebergDiffFiles(
      {name: 'src/a.ts', path: COMMIT, type: 'change'},
      {fetch: stubCodeberg([])},
    ),
  ).rejects.toThrow('Codeberg loader cannot read the old side of src/a.ts.')
})

test('a failed read names the file and the status', async () => {
  const fetcher = vi.fn<FetchLike>(async () => new Response('', {status: 404}))

  await expect(
    loadCodebergDiffFiles({name: 'src/a.ts', path: PULL, type: 'change'}, {fetch: fetcher}),
  ).rejects.toThrow('Codeberg pull acme/widgets#7 failed (404).')
})

test.each([
  {name: 'a compare', path: '/acme/widgets/compare/v1.0...v2.0'},
  {name: 'a GitHub pull request path', path: '/acme/widgets/pull/7'},
])('does not read $name', async ({path}) => {
  const fetcher = stubCodeberg()

  await expect(
    loadCodebergDiffFiles({name: 'src/a.ts', path, type: 'change'}, {fetch: fetcher}),
  ).rejects.toThrow('Unsupported Codeberg diff path.')
  expect(fetcher).not.toHaveBeenCalled()
})

// `new URL` resolves dot segments, so `../../users/x` would read another API route.
test.each([
  {name: 'a name that climbs out of the repository', file: {name: '../../../../users/someone'}},
  {name: 'a previous name with a dot segment', file: {name: 'src/a.ts', prevName: 'src/./a.ts'}},
])('does not read $name', async ({file}) => {
  const fetcher = stubCodeberg()

  await expect(
    loadCodebergDiffFiles({...file, path: COMMIT, type: 'rename-changed'}, {fetch: fetcher}),
  ).rejects.toThrow('Unsupported Codeberg file path.')
  expect(fetcher).not.toHaveBeenCalled()
})
