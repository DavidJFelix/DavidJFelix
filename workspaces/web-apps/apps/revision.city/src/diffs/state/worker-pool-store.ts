import type {WorkerStats} from '@pierre/diffs/worker'
import {createStore, type StoreSnapshot} from '@xstate/store'
import {isNullish} from '@/diffs/lib/nullish'
import {
  chooseWorkerRecovery,
  describeWorkerLoadFailure,
  type WorkerRecovery,
  type WorkerScriptReload,
} from '@/diffs/lib/worker-failure'

export type WorkerPoolState = 'initializing' | 'ready' | 'failed'

// A page recovers from a worker load failure only once. Each worker in the pool sends the same
// failure, and a second recovery after a failed restart would start the same restart again.
type WorkerPoolPhase =
  | {status: WorkerPoolState; recovery: 'available' | 'used'}
  | {status: 'recovering'; recovery: 'reloading-script' | 'restarting' | 'reloading-page'}

export type WorkerPoolStoreContext = WorkerPoolPhase & {
  stats?: WorkerStats
  restartPool?: () => Promise<void>
  reportedThrowMessages: readonly string[]
}

export interface WorkerPoolStoreParams {
  scriptUrl: string
  reloadWorkerScript: () => Promise<WorkerScriptReload>
  claimPageReload: () => boolean
  reloadPage: () => void
  reportFailure: (description: string) => void
  restartTimeLimitMs?: number
}

// The limit is longer than the 10 s default of the pool's `workerInitializationTimeout`, so that a
// slow restart that works can finish.
const RESTART_TIME_LIMIT_MS = 15_000

const initialContext: WorkerPoolStoreContext = {
  status: 'initializing',
  recovery: 'available',
  reportedThrowMessages: [],
}

function getWorkerPoolState(stats: WorkerStats | undefined): WorkerPoolState {
  if (stats?.workersFailed === true) return 'failed'
  return stats?.managerState === 'initialized' ? 'ready' : 'initializing'
}

function withStats(
  context: WorkerPoolStoreContext,
  stats: WorkerStats | undefined,
): WorkerPoolStoreContext {
  return context.status === 'recovering'
    ? {...context, stats}
    : {...context, stats, status: getWorkerPoolState(stats)}
}

function endRecovery(context: WorkerPoolStoreContext): WorkerPoolStoreContext {
  return {...context, status: getWorkerPoolState(context.stats), recovery: 'used'}
}

function endRestart(context: WorkerPoolStoreContext): WorkerPoolStoreContext | undefined {
  return context.recovery === 'restarting' ? endRecovery(context) : undefined
}

// While the page recovers from a load failure, the viewer waits as if the pool is still starting.
// A viewer that mounts without the pool keeps the main thread highlighter after the pool works again.
export function selectWorkerPoolState({
  context,
}: StoreSnapshot<WorkerPoolStoreContext>): WorkerPoolState {
  return context.status === 'recovering' ? 'initializing' : context.status
}

export function createWorkerPoolStore({
  scriptUrl,
  reloadWorkerScript,
  claimPageReload,
  reloadPage,
  reportFailure,
  restartTimeLimitMs = RESTART_TIME_LIMIT_MS,
}: WorkerPoolStoreParams) {
  function confirmRecovery(recovery: WorkerRecovery, canRestartPool: boolean): WorkerRecovery {
    if (recovery === 'reload-page') return claimPageReload() ? recovery : 'none'
    if (recovery === 'retry-pool') return canRestartPool ? recovery : 'none'
    return recovery
  }

  return createStore({
    context: initialContext,
    on: {
      poolAttached: (context, event: {restartPool: () => Promise<void>}) => ({
        ...context,
        restartPool: event.restartPool,
      }),
      poolDetached: (context) => ({...withStats(context, undefined), restartPool: undefined}),
      poolStatsChanged: (context, event: {stats: WorkerStats}) => withStats(context, event.stats),
      workerThrew: (context, event: {message: string; description: string}, enqueue) => {
        if (context.reportedThrowMessages.includes(event.message)) return undefined
        enqueue.effect(() => reportFailure(event.description))
        return {
          ...context,
          reportedThrowMessages: [...context.reportedThrowMessages, event.message],
        }
      },
      workerLoadFailed: (context, _event, enqueue) => {
        if (context.recovery !== 'available') return undefined
        enqueue.effect(({trigger, getSnapshot}) => {
          void reloadWorkerScript().then((reload) => {
            const canRestartPool = !isNullish(getSnapshot().context.restartPool)
            const recovery = confirmRecovery(chooseWorkerRecovery(reload), canRestartPool)
            reportFailure(describeWorkerLoadFailure({scriptUrl, reload, recovery}))
            trigger.recoveryChosen({recovery})
          })
        })
        return {...context, status: 'recovering', recovery: 'reloading-script'}
      },
      recoveryChosen: (context, event: {recovery: WorkerRecovery}, enqueue) => {
        if (context.recovery !== 'reloading-script') return undefined
        if (event.recovery === 'reload-page') {
          enqueue.effect(reloadPage)
          return {...context, recovery: 'reloading-page'}
        }
        const {restartPool} = context
        if (event.recovery === 'none' || isNullish(restartPool)) return endRecovery(context)
        enqueue.effect(({trigger}) => {
          void restartPool().then(
            () => trigger.restartFinished(),
            () => trigger.restartFailed(),
          )
          setTimeout(() => trigger.restartTimedOut(), restartTimeLimitMs)
        })
        return {...context, recovery: 'restarting'}
      },
      restartFinished: (context) => endRestart(context),
      restartFailed: (context) => endRestart(context),
      restartTimedOut: (context) => endRestart(context),
    },
  })
}
