import type {WorkerStats} from '@pierre/diffs/worker'
import {createStore, type StoreSnapshot} from '@xstate/store'
import * as z from 'zod/mini'
import {isNullish} from '@/diffs/lib/nullish'
import {
  chooseWorkerRecovery,
  describeWorkerLoadFailure,
  type WorkerRecovery,
  type WorkerScriptReload,
} from '@/diffs/lib/worker-failure'

const workerStatsSchema = z.custom<WorkerStats>()

const workerRecoverySchema = z.custom<WorkerRecovery>()

const restartPoolSchema = z.function({input: [], output: z.promise(z.void())})

const workerPoolStateSchema = z.enum(['initializing', 'ready', 'failed'])

const workerPoolDataShape = {
  stats: z.optional(workerStatsSchema),
  restartPool: z.optional(restartPoolSchema),
  reportedThrowMessages: z.readonly(z.array(z.string())),
}

// A page recovers from a worker load failure only once. Each worker in the pool sends the same
// failure, and a second recovery after a failed restart would start the same restart again.
const workerPoolStoreContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({
      ...workerPoolDataShape,
      status: workerPoolStateSchema,
      recovery: z.enum(['available', 'used']),
    }),
    z.object({
      ...workerPoolDataShape,
      status: z.literal('recovering'),
      recovery: z.enum(['reloading-script', 'restarting', 'reloading-page']),
    }),
  ]),
)

const workerPoolStoreEventSchemas = {
  poolAttached: z.object({restartPool: restartPoolSchema}),
  poolDetached: z.object({}),
  poolStatsChanged: z.object({stats: workerStatsSchema}),
  workerThrew: z.object({message: z.string(), description: z.string()}),
  workerLoadFailed: z.object({}),
  recoveryChosen: z.object({recovery: workerRecoverySchema}),
  restartFinished: z.object({}),
  restartFailed: z.object({}),
  restartTimedOut: z.object({}),
}

export type WorkerPoolState = z.infer<typeof workerPoolStateSchema>

export type WorkerPoolStoreContext = z.infer<typeof workerPoolStoreContextSchema>

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
  if (stats?.workersFailed === true) {
    return 'failed'
  }
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
    if (recovery === 'reload-page') {
      return claimPageReload() ? recovery : 'none'
    }
    if (recovery === 'retry-pool') {
      return canRestartPool ? recovery : 'none'
    }
    return recovery
  }

  return createStore({
    schemas: {context: workerPoolStoreContextSchema, events: workerPoolStoreEventSchemas},
    context: initialContext,
    on: {
      poolAttached: (context, event) => ({
        ...context,
        restartPool: event.restartPool,
      }),
      poolDetached: (context) => ({...withStats(context, undefined), restartPool: undefined}),
      poolStatsChanged: (context, event) => withStats(context, event.stats),
      workerThrew: (context, event, enqueue) => {
        if (context.reportedThrowMessages.includes(event.message)) {
          return undefined
        }
        enqueue.effect(() => reportFailure(event.description))
        return {
          ...context,
          reportedThrowMessages: [...context.reportedThrowMessages, event.message],
        }
      },
      workerLoadFailed: (context, _event, enqueue) => {
        if (context.recovery !== 'available') {
          return undefined
        }
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
      recoveryChosen: (context, event, enqueue) => {
        if (context.recovery !== 'reloading-script') {
          return undefined
        }
        if (event.recovery === 'reload-page') {
          enqueue.effect(reloadPage)
          return {...context, recovery: 'reloading-page'}
        }
        const {restartPool} = context
        if (event.recovery === 'none' || isNullish(restartPool)) {
          return endRecovery(context)
        }
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
