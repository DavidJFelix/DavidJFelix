// cSpell:ignore unstub -- vi.unstubAllGlobals
import {act} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {expect, test, vi} from 'vitest'

import type {EntityDiffRequest} from '@/symbols/lib/entity-diff-client'
import {type EntityDiffsState, useEntityDiffs} from './use-entity-diffs'

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const REQUESTS: readonly EntityDiffRequest[] = [
  {itemId: 'item-1', name: 'src/a.ts', type: 'change'},
  {itemId: 'item-2', name: 'src/b.ts', type: 'change'},
]

// The hook's fetch chain settles over several microtask ticks; one timer turn
// drains them all so assertions read settled state.
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function stubFetch() {
  return vi.fn<FetchLike>(async (_input, init) => {
    const body: {files: {itemId: string; name: string}[]} = JSON.parse(String(init?.body))
    const lines = body.files.map((file) =>
      JSON.stringify({
        itemId: file.itemId,
        name: file.name,
        diff: {
          path: file.name,
          language: 'typescript',
          changes: [{type: 'modified', kind: 'function', name: 'greet', qualifiedName: 'greet'}],
          summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 0},
        },
      }),
    )
    return new Response(lines.map((line) => `${line  }\n`).join(''))
  })
}

interface HookHarness {
  state: () => EntityDiffsState
  unmount: () => Promise<void>
}

async function mountHook(enabled: boolean): Promise<HookHarness> {
  let latest: EntityDiffsState = {entries: [], loadedCount: 0, totalCount: 0}
  function Probe() {
    latest = useEntityDiffs({enabled, requests: REQUESTS, sourcePath: 'o/r/pull/1'})
    return null
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root: Root | undefined
  await act(async () => {
    root = createRoot(container)
    root.render(<Probe />)
    await flushAsync()
  })
  return {
    state: () => latest,
    unmount: async () => {
      await act(async () => {
        root?.unmount()
        await flushAsync()
      })
      container.remove()
    },
  }
}

test('fetches nothing until the symbols tab asks for it', async () => {
  const fetcher = stubFetch()
  vi.stubGlobal('fetch', fetcher)

  const harness = await mountHook(false)

  expect(fetcher).not.toHaveBeenCalled()
  expect(harness.state().entries).toEqual([])
  await harness.unmount()
  vi.unstubAllGlobals()
})

test('reads every file over a single request once the tab is open', async () => {
  const fetcher = stubFetch()
  vi.stubGlobal('fetch', fetcher)

  const harness = await mountHook(true)

  // One streamed request covers the batch, rather than one request per file.
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(harness.state().entries.map((entry) => entry.status)).toEqual(['ready', 'ready'])
  expect(harness.state().loadedCount).toBe(2)
  await harness.unmount()
  vi.unstubAllGlobals()
})

test('reports the change list for each file it read', async () => {
  vi.stubGlobal('fetch', stubFetch())

  const harness = await mountHook(true)

  expect(harness.state().entries[0]?.diff?.changes).toMatchObject([
    {type: 'modified', qualifiedName: 'greet'},
  ])
  await harness.unmount()
  vi.unstubAllGlobals()
})

test('marks a file that could not be read without failing the rest', async () => {
  const fetcher = vi.fn<FetchLike>(
    async () =>
      new Response(
        `${JSON.stringify({itemId: 'item-1', name: 'src/a.ts', error: 'GitHub rate limit exceeded.'})}\n${JSON.stringify(
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
        )}\n`,
      ),
  )
  vi.stubGlobal('fetch', fetcher)

  const harness = await mountHook(true)

  expect(harness.state().entries.map((entry) => entry.status)).toEqual(['error', 'ready'])
  expect(harness.state().entries[0]?.error).toContain('rate limit')
  await harness.unmount()
  vi.unstubAllGlobals()
})

test('marks the whole batch when the request itself fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<FetchLike>(async () => new Response('', {status: 502})),
  )

  const harness = await mountHook(true)

  expect(harness.state().entries.map((entry) => entry.status)).toEqual(['error', 'error'])
  await harness.unmount()
  vi.unstubAllGlobals()
})
