import {act} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {expect, type Mock, test, vi} from 'vitest'

import {type PullRequestGroupsState, usePullRequestGroups} from './use-pull-request-groups'

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

// The hook's fetch chain settles over several microtask ticks (fetch, json,
// then setState); one setTimeout turn drains them all so assertions can read
// settled state.
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

interface HookHarness {
  state: () => PullRequestGroupsState
  unmount: () => Promise<void>
}

// Mounts the hook inside a probe component so tests can read its latest
// state without a testing-library dependency.
async function mountHook(): Promise<HookHarness> {
  let latest: PullRequestGroupsState = {status: 'idle', groups: []}
  function Probe() {
    latest = usePullRequestGroups(true)
    return null
  }
  const container = document.createElement('div')
  // appendChild, not append: this app's tsconfig pulls in @cloudflare/workers-types
  // alongside the DOM lib, and their `append` overloads collide badly enough that
  // the tidier call does not typecheck. site-mark.test.tsx does the same.
  document.body.appendChild(container)
  let root: Root | undefined
  await act(async () => {
    root = createRoot(container)
    root.render(<Probe />)
    await flushMicrotasks()
  })
  return {
    state: () => latest,
    unmount: async () => {
      await act(() => {
        root?.unmount()
      })
      container.remove()
    },
  }
}

function okResponse(pullRequestTitles: string[]): unknown {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        groups: [
          {
            kind: 'assigned',
            pullRequests: pullRequestTitles.map((title, index) => ({
              owner: 'acme',
              repo: 'repo',
              number: index + 1,
              title,
            })),
            totalCount: pullRequestTitles.length,
          },
        ],
      }),
  }
}

function stubFetch(firstResponse: unknown): Mock<() => Promise<unknown>> {
  const fetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValueOnce(firstResponse)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function titles(state: PullRequestGroupsState): string[] {
  return state.groups.flatMap((group) => group.pullRequests.map((pullRequest) => pullRequest.title))
}

test('loads pull request groups on mount', async () => {
  stubFetch(okResponse(['first']))
  const harness = await mountHook()

  expect(harness.state().status).toBe('loaded')
  expect(titles(harness.state())).toEqual(['first'])

  await harness.unmount()
})

test('window refocus starts a refetch while presenting the stale groups', async () => {
  const fetchMock = stubFetch(okResponse(['first']))
  const harness = await mountHook()

  let resolveRefetch!: (value: unknown) => void
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
  )
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()
  })

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(harness.state().status).toBe('loaded')
  expect(titles(harness.state())).toEqual(['first'])

  await act(async () => {
    resolveRefetch(okResponse(['second']))
    await flushMicrotasks()
  })
  expect(titles(harness.state())).toEqual(['second'])

  await harness.unmount()
})

test('a failed refocus refetch keeps the previously loaded groups', async () => {
  const fetchMock = stubFetch(okResponse(['first']))
  const harness = await mountHook()

  fetchMock.mockResolvedValueOnce({ok: false, json: () => Promise.resolve({})})
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()
  })

  expect(harness.state().status).toBe('loaded')
  expect(titles(harness.state())).toEqual(['first'])

  await harness.unmount()
})

test('refocus while a refetch is in flight does not start another request', async () => {
  const fetchMock = stubFetch(okResponse(['first']))
  const harness = await mountHook()

  fetchMock.mockImplementationOnce(() => new Promise(() => {}))
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()
  })

  expect(fetchMock).toHaveBeenCalledTimes(2)

  await harness.unmount()
})
