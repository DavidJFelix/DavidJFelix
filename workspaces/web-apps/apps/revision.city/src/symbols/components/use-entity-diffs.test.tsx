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
  return vi.fn<FetchLike>(async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input), 'https://revision.city')
    const name = url.searchParams.get('name') ?? ''
    return Response.json({
      path: name,
      language: 'typescript',
      changes: [{type: 'modified', kind: 'function', name: 'greet', qualifiedName: 'greet'}],
      summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 0},
    })
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
  // appendChild, not append: this app's tsconfig pulls in @cloudflare/workers-types
  // alongside the DOM lib, and their `append` overloads collide badly enough that
  // the tidier call does not typecheck.
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

test('reads every file once the tab is open', async () => {
  const fetcher = stubFetch()
  vi.stubGlobal('fetch', fetcher)

  const harness = await mountHook(true)

  expect(fetcher).toHaveBeenCalledTimes(2)
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
  const fetcher = vi.fn<FetchLike>(async (input) => {
    const url = new URL(typeof input === 'string' ? input : String(input), 'https://revision.city')
    if (url.searchParams.get('name') === 'src/a.ts') {
      return Response.json({error: 'GitHub rate limit exceeded.'}, {status: 502})
    }
    return Response.json({path: 'src/b.ts', changes: []})
  })
  vi.stubGlobal('fetch', fetcher)

  const harness = await mountHook(true)

  expect(harness.state().entries.map((entry) => entry.status)).toEqual(['error', 'ready'])
  expect(harness.state().entries[0]?.error).toContain('rate limit')
  await harness.unmount()
  vi.unstubAllGlobals()
})
