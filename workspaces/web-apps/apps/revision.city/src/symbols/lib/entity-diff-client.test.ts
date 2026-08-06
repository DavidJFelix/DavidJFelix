import {expect, test, vi} from 'vitest'

import {type EntityDiffStreamResult, streamEntityDiffs} from './entity-diff-client'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a plain stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const FILES = [
  {itemId: 'item-1', name: 'src/a.ts', type: 'change'},
  {itemId: 'item-2', name: 'src/b.ts', type: 'change'},
]

function createDiff(path: string) {
  return {
    path,
    language: 'typescript',
    changes: [{type: 'modified', kind: 'function', name: 'greet', qualifiedName: 'greet'}],
    summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 0},
  }
}

// Serves the body in caller-chosen chunks so line splitting is exercised.
function stubStream(chunks: readonly string[], status = 200) {
  return vi.fn<FetchLike>(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder()
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }
            controller.close()
          },
        }),
        {status},
      ),
  )
}

async function collect(fetcher: ReturnType<typeof stubStream>): Promise<EntityDiffStreamResult[]> {
  const results: EntityDiffStreamResult[] = []
  await streamEntityDiffs({
    fetcher,
    files: FILES,
    onResult: (result) => results.push(result),
    sourcePath: 'o/r/pull/1',
  })
  return results
}

test('posts the batch of files to the route', async () => {
  const fetcher = stubStream([])

  await collect(fetcher)

  const [, init] = fetcher.mock.calls[0] ?? []
  expect(init?.method).toBe('POST')
  expect(JSON.parse(String(init?.body))).toEqual({path: 'o/r/pull/1', files: FILES})
})

test('reports each file as its line arrives', async () => {
  const fetcher = stubStream([
    `${JSON.stringify({itemId: 'item-1', name: 'src/a.ts', diff: createDiff('src/a.ts')})}\n`,
    `${JSON.stringify({itemId: 'item-2', name: 'src/b.ts', diff: createDiff('src/b.ts')})}\n`,
  ])

  const results = await collect(fetcher)

  expect(results.map((result) => result.itemId)).toEqual(['item-1', 'item-2'])
  expect(results[0]?.diff?.changes).toMatchObject([{qualifiedName: 'greet'}])
})

test('reassembles a result split across chunks', async () => {
  const line = JSON.stringify({itemId: 'item-1', name: 'src/a.ts', diff: createDiff('src/a.ts')})
  const fetcher = stubStream([line.slice(0, 20), line.slice(20), '\n'])

  const results = await collect(fetcher)

  expect(results).toHaveLength(1)
  expect(results[0]?.diff?.path).toBe('src/a.ts')
})

test('accepts a final result with no trailing newline', async () => {
  const fetcher = stubStream([
    JSON.stringify({itemId: 'item-1', name: 'src/a.ts', diff: createDiff('src/a.ts')}),
  ])

  expect(await collect(fetcher)).toHaveLength(1)
})

test('carries a per-file failure without ending the stream', async () => {
  const fetcher = stubStream([
    `${JSON.stringify({itemId: 'item-1', name: 'src/a.ts', error: 'GitHub rate limit exceeded.'})}\n`,
    `${JSON.stringify({itemId: 'item-2', name: 'src/b.ts', diff: createDiff('src/b.ts')})}\n`,
  ])

  const results = await collect(fetcher)

  expect(results[0]?.error).toContain('rate limit')
  expect(results[1]?.diff).toBeDefined()
})

test('drops a malformed line rather than the whole stream', async () => {
  const fetcher = stubStream([
    'not json at all\n',
    `${JSON.stringify({itemId: 'item-2', name: 'src/b.ts', diff: createDiff('src/b.ts')})}\n`,
  ])

  const results = await collect(fetcher)

  expect(results).toHaveLength(1)
  expect(results[0]?.itemId).toBe('item-2')
})

test('surfaces the error the route reported', async () => {
  const fetcher = vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({error: 'At most 20 files per request.'}), {status: 400}),
  )

  await expect(
    streamEntityDiffs({fetcher, files: FILES, onResult: () => {}, sourcePath: 'o/r/pull/1'}),
  ).rejects.toThrow('At most 20 files per request.')
})

test('falls back to the status when the body carries no message', async () => {
  const fetcher = vi.fn<FetchLike>(async () => new Response('', {status: 502}))

  await expect(
    streamEntityDiffs({fetcher, files: FILES, onResult: () => {}, sourcePath: 'o/r/pull/1'}),
  ).rejects.toThrow('Symbol lookup failed (502).')
})
