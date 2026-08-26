import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {HttpResponse, type HttpResponseResolver, http, type PathParams} from 'msw'
import {setupServer} from 'msw/node'
import {expect, type Mock, onTestFinished, test, vi} from 'vitest'

import type {EntityDiffRequest} from '@/symbols/lib/entity-diff-client'
import {useEntityDiffs} from './use-entity-diffs'

const ENDPOINT = '/api/diffs/entity-diff'

const REQUESTS: readonly EntityDiffRequest[] = [
  {itemId: 'item-1', name: 'src/a.ts', type: 'change'},
  {itemId: 'item-2', name: 'src/b.ts', type: 'change'},
]

interface EntityDiffBody {
  files: {itemId: string; name: string}[]
}

type EntityDiffResolver = HttpResponseResolver<PathParams, EntityDiffBody>

const server = setupServer()
server.listen({onUnhandledRequest: 'error'})

function serveEntityDiffs(resolver: EntityDiffResolver): Mock<EntityDiffResolver> {
  const respond = vi.fn<EntityDiffResolver>(resolver)
  server.use(http.post(ENDPOINT, respond))
  onTestFinished(() => {
    server.resetHandlers()
  })
  return respond
}

function ndjson(lines: unknown[]): Response {
  return HttpResponse.text(lines.map((line) => `${JSON.stringify(line)}\n`).join(''))
}

// Reports one modified function for every file named in the request body.
const modifiedGreetPerFile: EntityDiffResolver = async ({request}) => {
  const body = await request.json()
  return ndjson(
    body.files.map((file) => ({
      itemId: file.itemId,
      name: file.name,
      diff: {
        path: file.name,
        language: 'typescript',
        changes: [{type: 'modified', kind: 'function', name: 'greet', qualifiedName: 'greet'}],
        summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 0},
      },
    })),
  )
}

function mountHook(enabled: boolean) {
  const hook = renderHook(() =>
    useEntityDiffs({enabled, requests: REQUESTS, sourcePath: 'o/r/pull/1'}),
  )
  onTestFinished(cleanup)
  return hook
}

// Mounts with the tab open and waits for every file to reach a final status.
async function mountSettled() {
  const hook = mountHook(true)
  await waitFor(() => {
    const statuses = hook.result.current.entries.map((entry) => entry.status)
    expect(statuses).toHaveLength(REQUESTS.length)
    expect(statuses).not.toContain('pending')
    expect(statuses).not.toContain('loading')
  })
  return hook
}

// Lets any request the hook might have started reach the server, since a
// never-made request is not something waitFor can wait for.
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

test('fetches nothing until the symbols tab asks for it', async () => {
  const respond = serveEntityDiffs(modifiedGreetPerFile)

  const {result} = mountHook(false)

  await settle()
  expect(respond).not.toHaveBeenCalled()
  expect(result.current.entries).toEqual([])
})

test('reads every file over a single request once the tab is open', async () => {
  const respond = serveEntityDiffs(modifiedGreetPerFile)

  const {result} = await mountSettled()

  // One streamed request covers the batch, rather than one request per file.
  expect(respond).toHaveBeenCalledTimes(1)
  expect(result.current.entries.map((entry) => entry.status)).toEqual(['ready', 'ready'])
  expect(result.current.loadedCount).toBe(2)
})

test('reports the change list for each file it read', async () => {
  serveEntityDiffs(modifiedGreetPerFile)

  const {result} = await mountSettled()

  expect(result.current.entries[0]?.diff?.changes).toMatchObject([
    {type: 'modified', qualifiedName: 'greet'},
  ])
})

test('marks a file that could not be read without failing the rest', async () => {
  serveEntityDiffs(() =>
    ndjson([
      {itemId: 'item-1', name: 'src/a.ts', error: 'GitHub rate limit exceeded.'},
      {
        itemId: 'item-2',
        name: 'src/b.ts',
        diff: {
          path: 'src/b.ts',
          language: 'typescript',
          changes: [],
          summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
        },
      },
    ]),
  )

  const {result} = await mountSettled()

  expect(result.current.entries.map((entry) => entry.status)).toEqual(['error', 'ready'])
  expect(result.current.entries[0]?.error).toContain('rate limit')
})

test('marks the whole batch when the request itself fails', async () => {
  serveEntityDiffs(() => new HttpResponse(null, {status: 502}))

  const {result} = await mountSettled()

  expect(result.current.entries.map((entry) => entry.status)).toEqual(['error', 'error'])
})
