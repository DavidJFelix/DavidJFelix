import {expect, test, vi} from 'vitest'

import {baseMovedOnLogic} from './base-moved-on-store'

const COMPARE_PATH = '/owner/repo/compare/main...feature'
const REQUEST = {path: COMPARE_PATH, range: 'main...feature'}

function stubCompareStatus(respond: () => Promise<Response>) {
  const fetchStatus = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(respond)
  vi.stubGlobal('fetch', fetchStatus)
  return fetchStatus
}

function stubPendingCompareStatus() {
  return stubCompareStatus(() => new Promise<Response>(() => {}))
}

test('a request for a compare whose base moved on answers with a notice', async () => {
  const fetchStatus = stubCompareStatus(async () => Response.json({behindBy: 3}))
  const store = baseMovedOnLogic.createStore()

  store.trigger.requested(REQUEST)

  expect(store.getSnapshot().context).toEqual({status: 'loading', requestId: 1, path: COMPARE_PATH})
  await vi.waitFor(() => {
    expect(store.getSnapshot().context).toEqual({
      status: 'answered',
      requestId: 1,
      path: COMPARE_PATH,
      notice: 'main moved on 3 commits since the merge base',
    })
  })
  expect(fetchStatus).toHaveBeenCalledWith(
    `/api/diffs/github-compare-status?${new URLSearchParams({path: COMPARE_PATH})}`,
    {cache: 'no-store'},
  )
})

test.each([
  {name: 'a base that did not move', respond: async () => Response.json({behindBy: 0})},
  {name: 'a failed lookup', respond: async () => Response.json({error: 'no'}, {status: 404})},
  {name: 'a network failure', respond: () => Promise.reject(new TypeError('offline'))},
])('$name answers with no notice', async ({respond}) => {
  stubCompareStatus(respond)
  const store = baseMovedOnLogic.createStore()

  store.trigger.requested(REQUEST)

  await vi.waitFor(() => {
    expect(store.getSnapshot().context).toMatchObject({status: 'answered', notice: undefined})
  })
})

test('an answer to an older request is dropped', () => {
  stubPendingCompareStatus()
  const store = baseMovedOnLogic.createStore()
  store.trigger.requested(REQUEST)
  store.trigger.requested({path: '/owner/repo/compare/feature', range: 'feature'})

  expect(store.can.answered({requestId: 1, notice: 'old'})).toBe(false)
  store.trigger.answered({requestId: 2, notice: 'new'})
  expect(store.getSnapshot().context).toMatchObject({path: '/owner/repo/compare/feature'})
})

test('an answer with no request is dropped', () => {
  const store = baseMovedOnLogic.createStore()

  expect(store.can.answered({requestId: 0, notice: 'stray'})).toBe(false)
})

test('a new request for the same path hides the old notice, and an answer with none clears it', () => {
  stubPendingCompareStatus()
  const store = baseMovedOnLogic.createStore()
  store.trigger.requested(REQUEST)
  store.trigger.answered({requestId: 1, notice: 'old'})

  store.trigger.requested(REQUEST)
  expect(store.getSnapshot().context.status).toBe('loading')
  store.trigger.answered({requestId: 2, notice: undefined})

  expect(store.getSnapshot().context).toMatchObject({status: 'answered', notice: undefined})
})
