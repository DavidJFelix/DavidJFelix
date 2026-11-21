import {expect, test} from 'vitest'

import {
  getPublishPhase,
  type PatchLoadContext,
  type PatchLoadError,
  patchLoadLogic,
} from './patch-load-store'

type PatchLoadStore = ReturnType<typeof patchLoadLogic.createStore>
type PatchLoadEvent = Parameters<PatchLoadStore['send']>[0]
type PatchRequestEvent = Extract<PatchLoadEvent, {requestId: number}>
type Status = PatchLoadContext['status']

const statuses: Status[] = ['fetching', 'streaming', 'parsing', 'ready', 'error']
const oldRequest = 1
const currentRequest = 2
const notFound: PatchLoadError = {message: 'Not found', remedy: null}

const reachStatus: Record<Status, (store: PatchLoadStore) => void> = {
  fetching: () => {},
  streaming: (store) => store.trigger.streamOpened({requestId: currentRequest}),
  parsing: (store) => store.trigger.parsingStarted({requestId: currentRequest}),
  ready: (store) => {
    store.trigger.parsingStarted({requestId: currentRequest})
    store.trigger.loadFinished({requestId: currentRequest})
  },
  error: (store) => store.trigger.loadFailed({requestId: currentRequest, error: notFound}),
}

// The store starts two loads, so the first one is an old request.
function createStoreIn(status: Status): PatchLoadStore {
  const store = patchLoadLogic.createStore()
  store.trigger.loadStarted()
  store.trigger.loadStarted()
  reachStatus[status](store)
  expect(store.getSnapshot().context.status).toBe(status)
  return store
}

test('a new store is fetching before its first request', () => {
  const store = patchLoadLogic.createStore()

  expect(store.getSnapshot().context).toEqual({loadAttempt: 0, requestId: 0, status: 'fetching'})
})

test.each(statuses)('loadStarted in %s starts the next request in fetching', (status) => {
  const store = createStoreIn(status)

  store.trigger.loadStarted()

  expect(store.getSnapshot().context).toEqual({loadAttempt: 0, requestId: 3, status: 'fetching'})
})

test('a streamed load publishes the tree, then the initial items, then finishes', () => {
  const store = createStoreIn('fetching')
  const publishPhase = () => getPublishPhase(store.getSnapshot().context)

  store.trigger.streamOpened({requestId: currentRequest})
  expect(publishPhase()).toBe('none')
  store.trigger.treePublished({requestId: currentRequest})
  expect(publishPhase()).toBe('tree')
  store.trigger.itemsPublished({requestId: currentRequest})
  expect(publishPhase()).toBe('initial-items')
  store.trigger.loadFinished({requestId: currentRequest})

  expect(store.getSnapshot().context).toEqual({
    loadAttempt: 0,
    requestId: currentRequest,
    status: 'ready',
  })
  expect(publishPhase()).toBeUndefined()
})

test('later publishes keep the snapshot once the initial items are out', () => {
  const store = createStoreIn('streaming')
  store.trigger.itemsPublished({requestId: currentRequest})
  const published = store.getSnapshot()

  store.trigger.treePublished({requestId: currentRequest})
  store.trigger.itemsPublished({requestId: currentRequest})

  expect(store.getSnapshot()).toBe(published)
  expect(store.can.itemsPublished({requestId: currentRequest})).toBe(true)
})

test.each<Status>(['fetching', 'streaming'])(
  'parsingStarted in %s parses, and loadFinished then finishes',
  (status) => {
    const store = createStoreIn(status)

    store.trigger.parsingStarted({requestId: currentRequest})
    expect(store.getSnapshot().context.status).toBe('parsing')
    store.trigger.loadFinished({requestId: currentRequest})

    expect(store.getSnapshot().context).toEqual({
      loadAttempt: 0,
      requestId: currentRequest,
      status: 'ready',
    })
  },
)

test.each(statuses)('loadFailed in %s keeps the message and the remedy in error', (status) => {
  const store = createStoreIn(status)
  const error: PatchLoadError = {
    message: 'Sign in to read this repository.',
    remedy: {kind: 'sign-in'},
  }

  store.trigger.loadFailed({requestId: currentRequest, error})

  expect(store.getSnapshot().context).toEqual({
    loadAttempt: 0,
    requestId: currentRequest,
    status: 'error',
    error,
  })
})

test('a retry in error counts the attempt, and the next load keeps the count', () => {
  const store = createStoreIn('error')

  store.trigger.retryRequested()
  expect(store.getSnapshot().context).toEqual({
    loadAttempt: 1,
    requestId: currentRequest,
    status: 'error',
    error: notFound,
  })
  store.trigger.loadStarted()

  expect(store.getSnapshot().context).toEqual({loadAttempt: 1, requestId: 3, status: 'fetching'})
})

const oldRequestEvents: [Status, PatchRequestEvent][] = [
  ['fetching', {type: 'streamOpened', requestId: oldRequest}],
  ['fetching', {type: 'parsingStarted', requestId: oldRequest}],
  ['streaming', {type: 'treePublished', requestId: oldRequest}],
  ['streaming', {type: 'itemsPublished', requestId: oldRequest}],
  ['streaming', {type: 'parsingStarted', requestId: oldRequest}],
  ['streaming', {type: 'loadFinished', requestId: oldRequest}],
  ['parsing', {type: 'loadFinished', requestId: oldRequest}],
  ['ready', {type: 'loadFailed', requestId: oldRequest, error: notFound}],
]

test.each(oldRequestEvents)('in %s, %j from an old request changes nothing', (status, event) => {
  const store = createStoreIn(status)
  const before = store.getSnapshot()

  store.send(event)

  expect(store.getSnapshot()).toBe(before)
  const [afterCurrent] = store.transition(before, {...event, requestId: currentRequest})
  expect(afterCurrent).not.toBe(before)
})

const illegalEvents: [Status, PatchLoadEvent][] = [
  ['fetching', {type: 'retryRequested'}],
  ['streaming', {type: 'retryRequested'}],
  ['ready', {type: 'retryRequested'}],
  ['streaming', {type: 'streamOpened', requestId: currentRequest}],
  ['parsing', {type: 'streamOpened', requestId: currentRequest}],
  ['fetching', {type: 'treePublished', requestId: currentRequest}],
  ['parsing', {type: 'itemsPublished', requestId: currentRequest}],
  ['parsing', {type: 'parsingStarted', requestId: currentRequest}],
  ['ready', {type: 'parsingStarted', requestId: currentRequest}],
  ['fetching', {type: 'loadFinished', requestId: currentRequest}],
  ['ready', {type: 'loadFinished', requestId: currentRequest}],
  ['error', {type: 'loadFinished', requestId: currentRequest}],
]

test.each(illegalEvents)('in %s, %j changes nothing', (status, event) => {
  const store = createStoreIn(status)
  const before = store.getSnapshot()

  store.send(event)

  expect(store.getSnapshot()).toBe(before)
})

test('a late stream answer cannot move a newer request out of fetching', () => {
  const store = createStoreIn('fetching')

  expect(store.can.streamOpened({requestId: oldRequest})).toBe(false)
  store.trigger.streamOpened({requestId: oldRequest})

  expect(store.getSnapshot().context.status).toBe('fetching')
})

test('an old stream that ends after a newer load opens its stream cannot finish it', () => {
  const store = createStoreIn('streaming')
  store.trigger.loadStarted()
  store.trigger.streamOpened({requestId: 3})

  expect(store.can.loadFinished({requestId: currentRequest})).toBe(false)
  store.trigger.loadFinished({requestId: currentRequest})

  expect(store.getSnapshot().context).toEqual({
    loadAttempt: 0,
    requestId: 3,
    status: 'streaming',
    publishPhase: 'none',
  })
})
