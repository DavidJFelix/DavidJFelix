// cSpell:ignore unstub -- vi.unstubAllEnvs
import {expect, test, vi} from 'vitest'

import {
  clearGitHubDiffFileServerCache,
  createGitHubFileReader,
  loadGitHubDiffFiles,
} from './github-diff-file-server'
import {getLoaderErrorStatus} from './loader-error'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const SOURCE = '/owner/repo/pull/7'

// Answers ref resolution and file reads so a request can run to completion.
function stubGitHub() {
  return vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/pulls/7')) {
      return Response.json({
        base: {sha: 'base-sha', repo: {full_name: 'owner/repo'}},
        head: {sha: 'head-sha', repo: {full_name: 'owner/repo'}},
      })
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

test('an anonymous read sends no credential even when a server token is configured', async () => {
  clearGitHubDiffFileServerCache()
  vi.stubEnv('DIFFSHUB_GITHUB_TOKEN', 'server-token-with-private-access')
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles(
    {name: 'src/a.ts', path: SOURCE, type: 'change'},
    {fetch: fetcher, tokenSource: 'anonymous'},
  )

  // Falling back to the server token here would hand every unauthenticated
  // visitor its reach, and cache private content where all of them share it.
  expect(authorizationHeaders(fetcher)).not.toContain('Bearer server-token-with-private-access')
  expect(authorizationHeaders(fetcher).every((header) => header === null)).toBe(true)
  vi.unstubAllEnvs()
})

// Pairs with the test above: without this, that one would still pass if the
// stubbed env never reached the code, proving nothing about the guard.
test('a read with no token source does fall back to the server token', async () => {
  clearGitHubDiffFileServerCache()
  vi.stubEnv('DIFFSHUB_GITHUB_TOKEN', 'server-token-with-private-access')
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles({name: 'src/a.ts', path: SOURCE, type: 'change'}, {fetch: fetcher})

  expect(authorizationHeaders(fetcher)).toContain('Bearer server-token-with-private-access')
  vi.unstubAllEnvs()
})

test("a signed-in read carries the caller's own token", async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles(
    {name: 'src/a.ts', path: SOURCE, type: 'change'},
    {fetch: fetcher, token: 'user-token', tokenSource: 'request'},
  )

  expect(authorizationHeaders(fetcher)).toContain('Bearer user-token')
})

test('hydrates an added file only when asked, so the viewer keeps its placeholder', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const placeholder = await loadGitHubDiffFiles(
    {name: 'src/new.ts', path: SOURCE, type: 'new'},
    {fetch: fetcher, tokenSource: 'anonymous'},
  )

  expect(placeholder.newFile?.contents).toBe('')
  expect(fetcher).not.toHaveBeenCalled()

  const hydrated = await loadGitHubDiffFiles(
    {name: 'src/new.ts', path: SOURCE, type: 'new'},
    {fetch: fetcher, tokenSource: 'anonymous', hydrateSingleSided: true},
  )

  expect(hydrated.newFile?.contents).toContain('greet')
  expect(hydrated.oldFile).toBeNull()
})

test('hydrates a deleted file from the base revision', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const {oldFile, newFile} = await loadGitHubDiffFiles(
    {name: 'src/gone.ts', path: SOURCE, type: 'deleted'},
    {fetch: fetcher, tokenSource: 'anonymous', hydrateSingleSided: true},
  )

  expect(oldFile?.contents).toContain('greet')
  expect(newFile).toBeNull()
})

function toHref(input: Parameters<FetchLike>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

test('a signed-in reader looks up the refs once for a batch of files', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()
  const readFiles = createGitHubFileReader(SOURCE, {
    fetch: fetcher,
    token: 'user-token',
    tokenSource: 'request',
  })

  await Promise.all([
    readFiles({name: 'src/a.ts', type: 'change'}),
    readFiles({name: 'src/b.ts', type: 'change'}),
  ])

  const urls = fetcher.mock.calls.map(([input]) => toHref(input))
  expect(urls.filter((url) => url.includes('/pulls/7'))).toHaveLength(1)
  expect(urls.filter((url) => url.includes('/compare/'))).toHaveLength(1)
})

test('a reader does not keep a failed lookup, so the next read tries again', async () => {
  clearGitHubDiffFileServerCache()
  const working = stubGitHub()
  let calls = 0
  const fetcher = vi.fn<FetchLike>(async (input, init) => {
    calls += 1
    return calls === 1 ? new Response('unavailable', {status: 503}) : working(input, init)
  })
  const readFiles = createGitHubFileReader(SOURCE, {
    fetch: fetcher,
    token: 'user-token',
    tokenSource: 'request',
  })

  await expect(readFiles({name: 'src/a.ts', type: 'change'})).rejects.toThrow('503')
  const {newFile} = await readFiles({name: 'src/a.ts', type: 'change'})

  expect(newFile?.contents).toContain('greet')
})

// The file endpoint answers with the status that the error carries.
test.each([
  {name: 'a revoked token', response: () => new Response('', {status: 401}), status: 401},
  {name: 'a missing pull request', response: () => new Response('', {status: 404}), status: 404},
  {
    name: 'a rate limit',
    response: () => new Response('', {status: 403, headers: {'x-ratelimit-remaining': '0'}}),
    status: 429,
  },
  {name: 'a GitHub outage', response: () => new Response('', {status: 503}), status: 502},
])('a reader gives $status for $name', async ({response, status}) => {
  clearGitHubDiffFileServerCache()
  const readFiles = createGitHubFileReader(SOURCE, {
    fetch: vi.fn<FetchLike>(async () => response()),
    token: 'user-token',
    tokenSource: 'request',
  })

  const error = await readFiles({name: 'src/a.ts', type: 'change'}).catch(
    (caught: unknown) => caught,
  )

  expect(getLoaderErrorStatus(error)).toBe(status)
})

test('a reader rejects a path that is not a GitHub diff', async () => {
  const readFiles = createGitHubFileReader('/owner/repo/issues/7', {tokenSource: 'anonymous'})

  const error = await readFiles({name: 'src/a.ts', type: 'change'}).catch(
    (caught: unknown) => caught,
  )

  expect(error).toHaveProperty('message', 'Unsupported GitHub diff path.')
  expect(getLoaderErrorStatus(error)).toBe(400)
})

// A dot segment that is percent-encoded in a compare range appears only after
// the decode, so the reader must not fetch the route it resolves to.
test.each([
  {name: 'a range that decodes to a dot segment', path: '/owner/repo/compare/%2e%2e'},
  {
    name: 'a range with an encoded dot segment inside it',
    path: '/owner/repo/compare/main%2F%2e%2e',
  },
])('a signed-in reader does not fetch $name', async ({path}) => {
  const fetcher = stubGitHub()
  const readFiles = createGitHubFileReader(path, {
    fetch: fetcher,
    token: 'visitor-token',
    tokenSource: 'request',
  })

  await expect(readFiles({name: 'src/a.ts', type: 'change'})).rejects.toThrow(
    'Unsupported GitHub diff path.',
  )
  expect(fetcher).not.toHaveBeenCalled()
})

// Counts the reads of each file path, and answers each file with `body`.
function stubGitHubFiles(body: string) {
  const reads = new Map<string, number>()
  const fetcher = vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/pulls/7')) {
      return Response.json({base: {sha: 'base-sha'}, head: {sha: 'head-sha'}})
    }
    if (url.includes('/compare/')) {
      return Response.json({merge_base_commit: {sha: 'merge-base-sha'}})
    }
    reads.set(url, (reads.get(url) ?? 0) + 1)
    return new Response(body)
  })
  return {fetcher, reads}
}

function readNewFile(name: string, fetcher: FetchLike) {
  return loadGitHubDiffFiles(
    {name, path: SOURCE, type: 'new'},
    {fetch: fetcher, tokenSource: 'anonymous', hydrateSingleSided: true},
  )
}

test('the shared cache keeps a recent file and drops the oldest past its size', async () => {
  clearGitHubDiffFileServerCache()
  const {fetcher, reads} = stubGitHubFiles('export const a = 1\n')

  await readNewFile('src/first.ts', fetcher)
  await readNewFile('src/first.ts', fetcher)
  await Promise.all(
    Array.from({length: 200}, (_, index) => readNewFile(`src/file-${index}.ts`, fetcher)),
  )
  await readNewFile('src/file-199.ts', fetcher)
  await readNewFile('src/first.ts', fetcher)

  const readsOf = (name: string) =>
    [...reads].find(([url]) => url.endsWith(`/head-sha/${name}`))?.[1]
  expect(readsOf('src/first.ts')).toBe(2)
  expect(readsOf('src/file-199.ts')).toBe(1)
})

test('the shared cache does not keep a large file', async () => {
  clearGitHubDiffFileServerCache()
  const {fetcher, reads} = stubGitHubFiles('// x\n'.repeat(60_000))

  await readNewFile('src/large.ts', fetcher)
  await readNewFile('src/large.ts', fetcher)

  expect([...reads.values()]).toEqual([2])
})

// `new URL` resolves dot segments, so `../../users/x` would read another API route.
test.each([
  {name: 'a name that climbs out of the repository', file: {name: '../../../../users/someone'}},
  {name: 'a previous name with a dot segment', file: {name: 'src/a.ts', prevName: 'src/./a.ts'}},
])('does not read $name', async ({file}) => {
  const fetcher = stubGitHub()

  await expect(
    loadGitHubDiffFiles(
      {...file, path: SOURCE, type: 'rename-changed'},
      {fetch: fetcher, token: 'visitor-token', tokenSource: 'request'},
    ),
  ).rejects.toThrow('Unsupported GitHub file path.')
  expect(fetcher).not.toHaveBeenCalled()
})
