import {expect, test, vi} from 'vitest'

import {MAX_FILES_PER_REQUEST} from './entity-diff-client'
import {handleEntityDiffRequest} from './entity-diff-endpoint'

const ORIGIN = 'https://revision.city'
const CODEBERG_PULL = '/acme/widgets/pulls/7'
const CODEBERG_PULL_API = 'https://codeberg.org/api/v1/repos/acme/widgets/pulls/7'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

function createRequest(body: unknown): Request {
  return new Request(`${ORIGIN}/api/diffs/entity-diff`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function toHref(input: Parameters<FetchLike>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

// Answers the lookup of one Codeberg pull request and the reads of its files.
// The merge base and the head have a different body of `greet`.
function stubCodeberg() {
  return vi.fn<FetchLike>(async (input) => {
    const url = new URL(toHref(input))
    if (url.href === CODEBERG_PULL_API) {
      return Response.json({merge_base: 'base-sha', head: {sha: 'head-sha'}})
    }
    const value = url.searchParams.get('ref') === 'base-sha' ? 1 : 2
    return new Response(`export function greet() {\n  return ${value}\n}\n`)
  })
}

async function readLines(response: Response): Promise<unknown[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
}

test.each([
  ['a body that is not JSON', 'not json'],
  ['a body with no path', {files: []}],
  ['a body with no files', {path: 'o/r/pull/1'}],
  [
    'a file with an unsupported change type',
    {path: 'o/r/pull/1', files: [{itemId: 'i', name: 'a.ts', type: 'exploded'}]},
  ],
  ['a file with no name', {path: 'o/r/pull/1', files: [{itemId: 'i', type: 'change'}]}],
  ['a domain that is not a string', {domain: 1, path: 'o/r/pull/1', files: []}],
  ['a domain with no symbol support', {domain: 'tangled.org', path: 'o/r/pulls/1', files: []}],
  [
    'a Codeberg compare, which has no merge base to read',
    {domain: 'codeberg.org', path: '/acme/widgets/compare/main...dev', files: []},
  ],
])('rejects %s', async (_case, body) => {
  const response = await handleEntityDiffRequest(createRequest(body))

  expect(response.status).toBe(400)
})

test('rejects a batch larger than one request should carry', async () => {
  const files = Array.from({length: MAX_FILES_PER_REQUEST + 1}, (_, index) => ({
    itemId: `item-${index}`,
    name: `src/file-${index}.ts`,
    type: 'change',
  }))

  const response = await handleEntityDiffRequest(createRequest({path: 'o/r/pull/1', files}))

  expect(response.status).toBe(400)
  await expect(response.json()).resolves.toMatchObject({
    error: expect.stringContaining('At most'),
  })
})

test('streams newline-delimited results', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toContain('application/x-ndjson')
  await expect(readLines(response)).resolves.toMatchObject([
    {itemId: 'item-1', name: 'src/moved.ts', diff: {changes: []}},
  ])
})

test('answers a pure rename without contacting GitHub', async () => {
  // No session cookie rides along, so a GitHub read would fail rather than
  // return an empty diff.
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  const [result] = await readLines(response)

  expect(result).toMatchObject({diff: {summary: {added: 0, deleted: 0, modified: 0}}})
})

test('reads a public diff without a signed-in session', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/a.ts', type: 'change'}],
    }),
  )

  expect(response.status).not.toBe(401)
})

test('keeps entity diffs out of shared caches', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  expect(response.headers.get('Cache-Control')).toContain('private')
  expect(response.headers.get('Vary')).toBe('Cookie')
})

test('reads a Codeberg diff from Codeberg with one lookup for the batch', async () => {
  const fetcher = stubCodeberg()

  const response = await handleEntityDiffRequest(
    createRequest({
      domain: 'codeberg.org',
      path: CODEBERG_PULL,
      files: [
        {itemId: 'item-1', name: 'src/a.ts', type: 'change'},
        {itemId: 'item-2', name: 'src/b.ts', type: 'change'},
      ],
    }),
    {fetch: fetcher},
  )

  const results = await readLines(response)
  expect(results).toHaveLength(2)
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        itemId: 'item-1',
        diff: expect.objectContaining({
          changes: [expect.objectContaining({type: 'modified', name: 'greet'})],
        }),
      }),
    ]),
  )
  const lookups = fetcher.mock.calls.filter(([input]) => toHref(input) === CODEBERG_PULL_API)
  expect(lookups).toHaveLength(1)
})

test('answers a file with no grammar without reading it', async () => {
  const fetcher = vi.fn<FetchLike>()

  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'assets/logo.png', type: 'change'}],
    }),
    {fetch: fetcher},
  )

  await expect(readLines(response)).resolves.toMatchObject([
    {itemId: 'item-1', name: 'assets/logo.png', diff: {language: null, changes: []}},
  ])
  expect(fetcher).not.toHaveBeenCalled()
})

// A body of 4 MB in chunks of 64 KB, with no Content-Length. `pulled` counts
// the chunks that a reader asked for.
function createLargeBody() {
  const counter = {pulled: 0}
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (counter.pulled === 64) {
        controller.close()
        return
      }
      counter.pulled += 1
      controller.enqueue(new TextEncoder().encode('// x\n'.repeat(13_107)))
    },
  })
  return {body, counter}
}

test('stops reading a GitHub file past the size limit and gives an empty diff', async () => {
  const large = createLargeBody()
  const fetcher = vi.fn<FetchLike>(async (input) => {
    const url = toHref(input)
    if (url.includes('/pulls/')) {
      return Response.json({base: {sha: 'base-sha'}, head: {sha: 'head-sha'}})
    }
    if (url.includes('/compare/')) {
      return Response.json({merge_base_commit: {sha: 'merge-base-sha'}})
    }
    return url.includes('head-sha') ? new Response(large.body) : new Response('')
  })

  const response = await handleEntityDiffRequest(
    createRequest({
      path: '/acme/large/pull/1',
      files: [{itemId: 'item-1', name: 'src/generated.ts', type: 'change'}],
    }),
    {fetch: fetcher},
  )

  await expect(readLines(response)).resolves.toEqual([
    {
      itemId: 'item-1',
      name: 'src/generated.ts',
      diff: {
        path: 'src/generated.ts',
        language: 'typescript',
        changes: [],
        summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
        skipped: 'too-large',
      },
    },
  ])
  expect(large.counter.pulled).toBeLessThan(64)
})

test('refuses a Codeberg file by its Content-Length and gives an empty diff', async () => {
  const large = createLargeBody()
  const fetcher = vi.fn<FetchLike>(async (input) => {
    const url = new URL(toHref(input))
    if (url.href === CODEBERG_PULL_API) {
      return Response.json({merge_base: 'base-sha', head: {sha: 'head-sha'}})
    }
    return new Response(large.body, {headers: {'Content-Length': String(4 * 1024 * 1024)}})
  })

  const response = await handleEntityDiffRequest(
    createRequest({
      domain: 'codeberg.org',
      path: CODEBERG_PULL,
      files: [{itemId: 'item-1', name: 'src/generated.ts', type: 'new'}],
    }),
    {fetch: fetcher},
  )

  await expect(readLines(response)).resolves.toMatchObject([
    {itemId: 'item-1', diff: {language: 'typescript', changes: [], skipped: 'too-large'}},
  ])
  expect(large.counter.pulled).toBeLessThanOrEqual(1)
})
