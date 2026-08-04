import {expect, test, vi} from 'vitest'

import {fetchEntityDiff} from './entity-diff-client'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a plain stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const REQUEST = {itemId: 'item-1', name: 'src/widget.ts', type: 'change'}

function stubFetch(body: unknown, status = 200) {
  return vi.fn<FetchLike>(async () => Response.json(body, {status}))
}

function readUrl(fetcher: ReturnType<typeof stubFetch>): URL {
  const [input] = fetcher.mock.calls[0] ?? []
  return new URL(typeof input === 'string' ? input : String(input), 'https://revision.city')
}

test('asks the route for the named file in the named diff', async () => {
  const fetcher = stubFetch({path: 'src/widget.ts', language: 'typescript', changes: []})

  await fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'})

  const url = readUrl(fetcher)
  expect(url.pathname).toBe('/api/diffs/entity-diff')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    path: 'o/r/pull/1',
    name: 'src/widget.ts',
    type: 'change',
  })
})

test('passes the previous name so a rename compares the right blobs', async () => {
  const fetcher = stubFetch({path: 'src/widget.ts', changes: []})

  await fetchEntityDiff({
    fetcher,
    request: {...REQUEST, type: 'rename-changed', prevName: 'src/old.ts'},
    sourcePath: 'o/r/pull/1',
  })

  expect(readUrl(fetcher).searchParams.get('prevName')).toBe('src/old.ts')
})

test('returns the reported changes and summary', async () => {
  const change = {
    type: 'modified',
    kind: 'function',
    name: 'greet',
    qualifiedName: 'greet',
    newRange: {startLine: 4, endLine: 6},
  }
  const fetcher = stubFetch({
    path: 'src/widget.ts',
    language: 'typescript',
    changes: [change],
    summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 0},
  })

  const diff = await fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'})

  expect(diff.changes).toEqual([change])
  expect(diff.summary.modified).toBe(1)
})

test('rebuilds a missing summary from the changes', async () => {
  const fetcher = stubFetch({
    path: 'src/widget.ts',
    changes: [
      {type: 'added', kind: 'function', name: 'a', qualifiedName: 'a'},
      {type: 'deleted', kind: 'function', name: 'b', qualifiedName: 'b'},
    ],
  })

  const diff = await fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'})

  expect(diff.summary).toEqual({added: 1, deleted: 1, modified: 0, moved: 0, renamed: 0})
})

test('drops malformed entries rather than rendering them', async () => {
  const fetcher = stubFetch({
    path: 'src/widget.ts',
    changes: [{type: 'added', kind: 'function', name: 'a', qualifiedName: 'a'}, {nonsense: true}],
  })

  const diff = await fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'})

  expect(diff.changes).toHaveLength(1)
})

test('surfaces the error the route reported', async () => {
  const fetcher = stubFetch({error: 'Symbol tracking requires signing in with GitHub.'}, 401)

  await expect(
    fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'}),
  ).rejects.toThrow('Symbol tracking requires signing in with GitHub.')
})

test('falls back to the status when the body carries no message', async () => {
  const fetcher = vi.fn<FetchLike>(async () => new Response('', {status: 502}))

  await expect(
    fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'}),
  ).rejects.toThrow('Symbol lookup failed (502).')
})

test('rejects a response that is not an entity diff', async () => {
  const fetcher = stubFetch({unexpected: true})

  await expect(
    fetchEntityDiff({fetcher, request: REQUEST, sourcePath: 'o/r/pull/1'}),
  ).rejects.toThrow('invalid response')
})
