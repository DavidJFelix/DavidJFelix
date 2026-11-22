import {expect, test, vi} from 'vitest'

import {MAX_FILES_PER_REQUEST, type SymbolDiffRequest} from '@/symbols/lib/symbol-diff-client'
import {listEntries, symbolDiffsLogic} from './symbol-diffs-store'

const SOURCE_PATH = 'o/r/pull/1'
const store = symbolDiffsLogic.createStore({sourcePath: SOURCE_PATH})

type SymbolDiffsEvent = Parameters<typeof store.send>[0]
type SymbolDiffsSnapshot = ReturnType<typeof store.getSnapshot>

function file(index: number): SymbolDiffRequest {
  return {itemId: `item-${index}`, name: `src/${index}.ts`, type: 'change'}
}

const FILES = [file(1), {...file(2), prevName: 'src/old-2.ts', type: 'rename-changed'}]
const [FIRST, SECOND] = FILES

function manyFiles(count: number): SymbolDiffRequest[] {
  return Array.from({length: count}, (_, index) => file(index))
}

function resultLine(request: SymbolDiffRequest) {
  const summary = {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0}
  return {
    itemId: request.itemId,
    name: request.name,
    diff: {path: request.name, language: 'typescript', changes: [], summary},
  }
}

function answered(request: SymbolDiffRequest): SymbolDiffsEvent {
  return {type: 'resultArrived', batchId: 1, result: resultLine(request)}
}

function failed(request: SymbolDiffRequest): SymbolDiffsEvent {
  const result = {itemId: request.itemId, name: request.name, error: 'GitHub rate limit exceeded.'}
  return {type: 'resultArrived', batchId: 1, result}
}

function listed(requests: readonly SymbolDiffRequest[] = FILES): SymbolDiffsEvent {
  return {type: 'requestsChanged', requests}
}

function replay(
  events: readonly SymbolDiffsEvent[],
  from: SymbolDiffsSnapshot = store.getInitialSnapshot(),
): SymbolDiffsSnapshot {
  return events.reduce((snapshot, event) => store.transition(snapshot, event)[0], from)
}

function statuses(snapshot: SymbolDiffsSnapshot): string[] {
  return listEntries(snapshot.context).map((entry) => entry.status)
}

function stubFetch(respond: () => Promise<Response>) {
  const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(respond)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

test.each<[string, readonly SymbolDiffsEvent[], SymbolDiffsEvent]>([
  ['a batch before the request list', [], {type: 'batchStarted'}],
  ['a second batch while one is in flight', [listed()], {type: 'batchStarted'}],
  ['an abort while stopped', [], {type: 'aborted'}],
  ['a retry when no file failed', [listed(), answered(FIRST), answered(SECOND)], {type: 'retried'}],
  ['a result for an earlier batch', [listed(), {type: 'aborted'}, listed()], answered(FIRST)],
  [
    'a stream end for an earlier batch',
    [listed(), {type: 'aborted'}, listed()],
    {type: 'streamEnded', batchId: 1},
  ],
  [
    'a failure for an aborted batch',
    [listed(), {type: 'aborted'}],
    {type: 'batchFailed', batchId: 1, error: 'Aborted'},
  ],
  ['a result for a file outside the batch', [listed()], answered(file(3))],
  ['a second result for one file', [listed(), answered(FIRST)], answered(FIRST)],
  ['a change to the same source', [], {type: 'sourceChanged', sourcePath: SOURCE_PATH}],
])('ignores %s', (_name, history, event) => {
  const snapshot = replay(history)

  const [next, effects] = store.transition(snapshot, event)

  expect(next).toBe(snapshot)
  expect(effects).toEqual([])
})

test('sends the first batch of files as soon as the request list arrives', () => {
  const files = manyFiles(MAX_FILES_PER_REQUEST + 2)

  const [snapshot, effects] = store.transition(store.getInitialSnapshot(), listed(files))

  expect(snapshot.context.status).toBe('reading')
  expect(statuses(snapshot)).toEqual([
    ...Array.from({length: MAX_FILES_PER_REQUEST}, () => 'loading'),
    'pending',
    'pending',
  ])
  expect(effects).toHaveLength(1)
})

test('marks each file ready or failed as its result arrives', () => {
  const snapshot = replay([listed(), failed(FIRST), answered(SECOND)])

  expect(statuses(snapshot)).toEqual(['error', 'ready'])
  expect(listEntries(snapshot.context)[0]?.error).toBe('GitHub rate limit exceeded.')
})

test('fails the files that the stream did not answer, then sends the next batch', () => {
  const files = manyFiles(MAX_FILES_PER_REQUEST + 1)

  const snapshot = replay([listed(files), answered(file(0)), {type: 'streamEnded', batchId: 1}])

  const entries = listEntries(snapshot.context)
  expect(entries.map((entry) => entry.status)).toEqual([
    'ready',
    ...Array.from({length: MAX_FILES_PER_REQUEST - 1}, () => 'error'),
    'loading',
  ])
  expect(entries[1]?.error).toBe('No result for this file.')
  expect(snapshot.context.batch?.id).toBe(2)
})

test('a failed batch fails only the files that have no result', () => {
  const error = 'Symbol lookup failed (502).'

  const snapshot = replay([listed(), answered(FIRST), {type: 'batchFailed', batchId: 1, error}])

  expect(listEntries(snapshot.context)).toMatchObject([{status: 'ready'}, {status: 'error', error}])
  expect(snapshot.context.status).toBe('idle')
})

test('an abort keeps the results that arrived and sends only the rest again', () => {
  const stopped = replay([listed(), answered(FIRST), {type: 'aborted'}])
  expect(statuses(stopped)).toEqual(['ready', 'pending'])

  const resumed = replay([listed()], stopped)

  expect(resumed.context.batch?.unanswered).toEqual([SECOND])
})

test('a retry sends only the files that failed', () => {
  const settled = replay([
    listed(),
    failed(FIRST),
    answered(SECOND),
    {type: 'streamEnded', batchId: 1},
  ])

  const retried = replay([{type: 'retried'}], settled)

  expect(statuses(retried)).toEqual(['loading', 'ready'])
  expect(retried.context.batch?.unanswered).toEqual([FIRST])
})

test('a retry while stopped waits for the next request list', () => {
  const failedFirst = [
    listed(),
    failed(FIRST),
    answered(SECOND),
    {type: 'streamEnded', batchId: 1},
  ] as const

  const snapshot = replay([...failedFirst, {type: 'aborted'}, {type: 'retried'}])

  expect(snapshot.context.status).toBe('stopped')
  expect(statuses(snapshot)).toEqual(['pending', 'ready'])
})

test('a new request list during a batch waits for that batch to end', () => {
  const snapshot = replay([listed(), listed([...FILES, file(3)])])

  expect(statuses(snapshot)).toEqual(['loading', 'loading', 'pending'])
  expect(snapshot.context.batch?.id).toBe(1)
})

test('a source change drops the results and reads every file again', () => {
  const event: SymbolDiffsEvent = {
    type: 'sourceChanged',
    domain: 'codeberg.org',
    sourcePath: 'o/r/pulls/2',
  }

  const snapshot = replay([listed(), answered(FIRST), event])

  expect(statuses(snapshot)).toEqual(['loading', 'loading'])
  expect(snapshot.context).toMatchObject({domain: 'codeberg.org', sourcePath: 'o/r/pulls/2'})
  expect(snapshot.context.batch?.id).toBe(2)
})

test('a source change while stopped drops the results and sends nothing', () => {
  const event: SymbolDiffsEvent = {type: 'sourceChanged', sourcePath: 'o/r/pull/2'}

  const snapshot = replay([listed(), answered(FIRST), {type: 'aborted'}, event])

  expect(snapshot.context.status).toBe('stopped')
  expect(statuses(snapshot)).toEqual(['pending', 'pending'])
})

test('reads a batch over the stream and fails the files it did not answer', async () => {
  stubFetch(async () => new Response(`${JSON.stringify(resultLine(FIRST))}\n`))
  const live = symbolDiffsLogic.createStore({sourcePath: SOURCE_PATH})

  live.trigger.requestsChanged({requests: FILES})

  await vi.waitFor(() => {
    expect(live.getSnapshot().context.status).toBe('idle')
  })
  expect(live.selectors.entries.get().map((entry) => entry.status)).toEqual(['ready', 'error'])
})

test.each([
  [new Error('Network is down.'), 'Network is down.'],
  ['offline', 'Symbol lookup failed.'],
])('a request that fails with %s fails its batch', async (reason, message) => {
  stubFetch(() => Promise.reject(reason))
  const live = symbolDiffsLogic.createStore({sourcePath: SOURCE_PATH})

  live.trigger.requestsChanged({requests: FILES})

  await vi.waitFor(() => {
    expect(live.getSnapshot().context.status).toBe('idle')
  })
  expect(live.selectors.entries.get().map((entry) => entry.error)).toEqual([message, message])
})

test.each<[string, SymbolDiffsEvent]>([
  ['an abort', {type: 'aborted'}],
  ['a source change', {type: 'sourceChanged', sourcePath: 'o/r/pull/2'}],
])('%s cancels the request in flight', (_name, event) => {
  const fetch = stubFetch(() => new Promise(() => {}))
  const live = symbolDiffsLogic.createStore({sourcePath: SOURCE_PATH})
  live.trigger.requestsChanged({requests: FILES})

  live.send(event)

  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
})
