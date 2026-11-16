import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {expect, type Mock, onTestFinished, test, vi} from 'vitest'

import {useBaseMovedOn} from './use-base-moved-on'

const ENDPOINT = '/api/diffs/github-compare-status'
const COMPARE_PATH = '/owner/repo/compare/main...feature'

const server = setupServer()
server.listen({onUnhandledFrame: 'error'})

type Respond = () => Response | Promise<Response>

function serveStatus(respond: Respond): Mock<Respond> {
  const handler = vi.fn<Respond>(respond)
  server.use(http.get(ENDPOINT, () => handler()))
  onTestFinished(() => {
    server.resetHandlers()
  })
  return handler
}

function mount(params: Parameters<typeof useBaseMovedOn>[0]) {
  const hook = renderHook(() => useBaseMovedOn(params))
  onTestFinished(cleanup)
  return hook
}

test('a signed-in compare whose base moved on gets a notice', async () => {
  serveStatus(() => HttpResponse.json({behindBy: 3}))

  const hook = mount({path: COMPARE_PATH, signedIn: true})

  await waitFor(() => {
    expect(hook.result.current).toBe('main moved on 3 commits since the merge base')
  })
})

test.each([
  {name: 'a base that did not move', respond: () => HttpResponse.json({behindBy: 0})},
  {name: 'a two-dot compare', respond: () => HttpResponse.json({behindBy: null})},
  {name: 'a failed lookup', respond: () => HttpResponse.json({error: 'no'}, {status: 404})},
  {name: 'a body that is not JSON', respond: () => new HttpResponse('oops')},
  {name: 'a network failure', respond: () => HttpResponse.error()},
])('$name gets no notice', async ({respond}) => {
  const handler = serveStatus(respond)

  const hook = mount({path: COMPARE_PATH, signedIn: true})

  await waitFor(() => {
    expect(handler).toHaveBeenCalledOnce()
  })
  // A later answer would land after the request settles, so give it a turn.
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(hook.result.current).toBeUndefined()
})

test.each([
  {name: 'a signed-out visitor', path: COMPARE_PATH, signedIn: false, domain: undefined},
  {name: 'a pull request', path: '/owner/repo/pull/7', signedIn: true, domain: undefined},
  {name: 'an alternate domain', path: COMPARE_PATH, signedIn: true, domain: 'codeberg.org'},
])('$name makes no request', async ({path, signedIn, domain}) => {
  const handler = serveStatus(() => HttpResponse.json({behindBy: 3}))

  const hook = mount({domain, path, signedIn})

  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(handler).not.toHaveBeenCalled()
  expect(hook.result.current).toBeUndefined()
})

test('an answer that lands after unmount is dropped', async () => {
  let release: (() => void) | undefined
  const handler = serveStatus(
    () =>
      new Promise((resolve) => {
        release = () => resolve(HttpResponse.json({behindBy: 3}))
      }),
  )

  const hook = mount({path: COMPARE_PATH, signedIn: true})
  await waitFor(() => {
    expect(handler).toHaveBeenCalledOnce()
  })
  hook.unmount()
  release?.()

  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(hook.result.current).toBeUndefined()
})

test('a new path shows no notice until its own answer', async () => {
  serveStatus(() => HttpResponse.json({behindBy: 3}))
  const hook = renderHook(({path}) => useBaseMovedOn({path, signedIn: true}), {
    initialProps: {path: COMPARE_PATH},
  })
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(hook.result.current).toBeDefined()
  })

  hook.rerender({path: '/owner/repo/compare/feature'})

  expect(hook.result.current).toBeUndefined()
  await waitFor(() => {
    expect(hook.result.current).toBe('The base branch moved on 3 commits since the merge base')
  })
})
