import type {WorkerStats} from '@pierre/diffs/worker'
import type {StoreSnapshot} from '@xstate/store'
import {expect, test, vi} from 'vitest'
import type {WorkerScriptReload} from '@/diffs/lib/worker-failure'
import {
  createWorkerPoolStore,
  selectWorkerPoolState,
  type WorkerPoolStoreContext,
} from './worker-pool-store'

const SCRIPT_URL = '/assets/worker-portable-abc.js'

function poolStats(stats: Pick<WorkerStats, 'managerState' | 'workersFailed'>): WorkerStats {
  return {
    totalWorkers: 3,
    busyWorkers: 0,
    queuedTasks: 0,
    activeTasks: 0,
    themeSubscribers: 0,
    fileCacheSize: 0,
    diffCacheSize: 0,
    ...stats,
  }
}

const STARTING = poolStats({managerState: 'initializing', workersFailed: false})
const READY = poolStats({managerState: 'initialized', workersFailed: false})
const FAILED = poolStats({managerState: 'waiting', workersFailed: true})

function scriptReload(status: number): WorkerScriptReload {
  return {kind: 'response', status, contentType: 'text/javascript', byteLength: 25}
}

interface TestStoreOptions {
  reload?: WorkerScriptReload
  pageReloadClaimed?: boolean
  restartTimeLimitMs?: number
}

function createTestStore({
  reload = scriptReload(200),
  pageReloadClaimed = true,
  restartTimeLimitMs,
}: TestStoreOptions = {}) {
  const reloadWorkerScript = vi.fn<() => Promise<WorkerScriptReload>>(async () => reload)
  const reloadPage = vi.fn<() => void>()
  const reportFailure = vi.fn<(description: string) => void>()
  const store = createWorkerPoolStore({
    scriptUrl: SCRIPT_URL,
    reloadWorkerScript,
    claimPageReload: () => pageReloadClaimed,
    reloadPage,
    reportFailure,
    restartTimeLimitMs,
  })
  return {store, reloadWorkerScript, reloadPage, reportFailure}
}

function controlledRestart() {
  const settle = {finish: () => {}, fail: () => {}}
  const restartPool = vi.fn<() => Promise<void>>(
    () =>
      new Promise<void>((resolve, reject) => {
        settle.finish = resolve
        settle.fail = () => reject(new Error('The restart failed.'))
      }),
  )
  return {restartPool, settle}
}

test.each([
  {name: 'a pool that starts', stats: STARTING, state: 'initializing'},
  {name: 'an initialized pool', stats: READY, state: 'ready'},
  {name: 'a pool whose workers failed', stats: FAILED, state: 'failed'},
])('the viewer sees $state for $name', ({stats, state}) => {
  const {store} = createTestStore()

  store.trigger.poolStatsChanged({stats})

  expect(selectWorkerPoolState(store.getSnapshot())).toBe(state)
  expect(store.getSnapshot().context.stats).toBe(stats)
})

test('a detached pool leaves no stats and no restart behind, and the viewer waits for the next pool', () => {
  const {store} = createTestStore()
  store.trigger.poolAttached({restartPool: async () => {}})
  store.trigger.poolStatsChanged({stats: READY})

  store.trigger.poolDetached()

  const {context} = store.getSnapshot()
  expect(selectWorkerPoolState(store.getSnapshot())).toBe('initializing')
  expect(context.stats).toBeUndefined()
  expect(context.restartPool).toBeUndefined()
})

test('the page reports each worker throw message once', () => {
  const {store, reportFailure} = createTestStore()

  store.trigger.workerThrew({message: 'boom', description: 'The worker threw boom.'})
  store.trigger.workerThrew({message: 'boom', description: 'The worker threw boom again.'})
  store.trigger.workerThrew({message: 'bang', description: 'The worker threw bang.'})

  expect(reportFailure.mock.calls).toEqual([['The worker threw boom.'], ['The worker threw bang.']])
  expect(store.can.workerThrew({message: 'boom', description: ''})).toBe(false)
})

test('the pool restarts when the refetch finds the script, and the viewer waits until it finishes', async () => {
  const {store, reloadWorkerScript, reportFailure} = createTestStore()
  const {restartPool, settle} = controlledRestart()
  store.trigger.poolAttached({restartPool})
  store.trigger.poolStatsChanged({stats: FAILED})

  store.trigger.workerLoadFailed()
  store.trigger.workerLoadFailed()
  await vi.waitFor(() => expect(restartPool).toHaveBeenCalledOnce())
  store.trigger.poolStatsChanged({stats: READY})

  expect(selectWorkerPoolState(store.getSnapshot())).toBe('initializing')
  expect(reloadWorkerScript).toHaveBeenCalledOnce()
  expect(reportFailure).toHaveBeenCalledWith(
    expect.stringMatching(/returned 200 .* The page starts the worker pool again\.$/),
  )

  settle.finish()
  await vi.waitFor(() => expect(store.getSnapshot().context.recovery).toBe('used'))

  expect(selectWorkerPoolState(store.getSnapshot())).toBe('ready')
  expect(store.can.restartTimedOut()).toBe(false)
})

test('a failed restart leaves the pool failed, and a later load failure starts no second recovery', async () => {
  const {store, reloadWorkerScript} = createTestStore()
  const {restartPool, settle} = controlledRestart()
  store.trigger.poolAttached({restartPool})
  store.trigger.poolStatsChanged({stats: FAILED})
  store.trigger.workerLoadFailed()
  await vi.waitFor(() => expect(restartPool).toHaveBeenCalledOnce())

  settle.fail()
  await vi.waitFor(() => expect(store.getSnapshot().context.recovery).toBe('used'))
  store.trigger.workerLoadFailed()

  expect(selectWorkerPoolState(store.getSnapshot())).toBe('failed')
  expect(store.can.workerLoadFailed()).toBe(false)
  expect(reloadWorkerScript).toHaveBeenCalledOnce()
})

test('a restart that never settles ends at the time limit, and its late answer changes nothing', async () => {
  const {store} = createTestStore({restartTimeLimitMs: 1})
  const {restartPool, settle} = controlledRestart()
  store.trigger.poolAttached({restartPool})
  store.trigger.poolStatsChanged({stats: FAILED})

  store.trigger.workerLoadFailed()
  await vi.waitFor(() => expect(store.getSnapshot().context.recovery).toBe('used'))
  const timedOut = store.getSnapshot()
  settle.finish()
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(selectWorkerPoolState(timedOut)).toBe('failed')
  expect(store.getSnapshot()).toBe(timedOut)
})

test('a script that a deploy removed reloads the page, and the viewer waits for the reload', async () => {
  const {store, reloadPage, reportFailure} = createTestStore({reload: scriptReload(404)})
  store.trigger.poolAttached({restartPool: async () => {}})

  store.trigger.workerLoadFailed()
  await vi.waitFor(() => expect(reloadPage).toHaveBeenCalledOnce())

  expect(store.getSnapshot().context.recovery).toBe('reloading-page')
  expect(selectWorkerPoolState(store.getSnapshot())).toBe('initializing')
  expect(reportFailure).toHaveBeenCalledWith(
    expect.stringMatching(/ The page reloads once to get the current deploy\.$/),
  )
})

test.each([
  {name: 'a server error', status: 503, pageReloadClaimed: true, attached: true},
  {name: 'a removed script after a reload', status: 404, pageReloadClaimed: false, attached: true},
  {name: 'a found script with no pool', status: 200, pageReloadClaimed: true, attached: false},
])('the recovery ends with no restart and no reload for $name', async (row) => {
  const {store, reloadPage, reportFailure} = createTestStore({
    reload: scriptReload(row.status),
    pageReloadClaimed: row.pageReloadClaimed,
  })
  const {restartPool} = controlledRestart()
  if (row.attached) store.trigger.poolAttached({restartPool})
  store.trigger.poolStatsChanged({stats: FAILED})

  store.trigger.workerLoadFailed()
  await vi.waitFor(() => expect(store.getSnapshot().context.recovery).toBe('used'))

  expect(selectWorkerPoolState(store.getSnapshot())).toBe('failed')
  expect(restartPool).not.toHaveBeenCalled()
  expect(reloadPage).not.toHaveBeenCalled()
  expect(reportFailure).toHaveBeenCalledWith(expect.stringMatching(/navigator\.onLine is \w+\.$/))
})

test('a restart choice ends the recovery when the pool detached during the refetch', () => {
  const {store} = createTestStore()
  const reloadingScript: StoreSnapshot<WorkerPoolStoreContext> = {
    ...store.getSnapshot(),
    context: {status: 'recovering', recovery: 'reloading-script', reportedThrowMessages: []},
  }

  const [next, effects] = store.transition(reloadingScript, {
    type: 'recoveryChosen',
    recovery: 'retry-pool',
  })

  expect(next.context).toMatchObject({status: 'initializing', recovery: 'used'})
  expect(effects).toEqual([])
})

test.each([
  {type: 'recoveryChosen', recovery: 'retry-pool'},
  {type: 'restartFinished'},
  {type: 'restartFailed'},
  {type: 'restartTimedOut'},
] as const)('the store refuses $type before a load failure', (event) => {
  const {store} = createTestStore()
  const initial = store.getSnapshot()

  const [next, effects] = store.transition(initial, event)

  expect(next).toBe(initial)
  expect(effects).toEqual([])
})
