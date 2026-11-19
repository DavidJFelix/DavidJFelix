// cSpell:ignore ASTLRU -- worker pool option name from @pierre/diffs
import {areWorkerStatsEqual, DEFAULT_THEMES} from '@pierre/diffs'
import {
  useWorkerPool,
  type WorkerInitializationRenderOptions,
  WorkerPoolContextProvider,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
import type {WorkerStats} from '@pierre/diffs/worker'
// The portable build of the highlight worker is one script with no imports. The standard build
// makes Vite put every shiki grammar into the worker chunk. A worker cannot load those grammars:
// the main thread resolves the languages and sends them to the workers. `workerFactory` below
// constructs the worker, only in the browser.
import * as DiffsRenderWorkerUrlModule from '@pierre/diffs/worker/worker-portable.js?worker&url'
import {useSelector} from '@xstate/store-react'
import {type ReactNode, useEffect} from 'react'
import {isNullish} from '@/diffs/lib/nullish'
import {describeWorkerThrow, reloadWorkerScript} from '@/diffs/lib/worker-failure'
import {
  createWorkerPoolStore,
  selectWorkerPoolState,
  type WorkerPoolState,
} from '@/diffs/state/worker-pool-store'
import {claimPageReload} from '@/lib/claim-page-reload'

// Vite's ?worker transform creates the default export, and vite/client types it with
// `declare module '*?worker&url'`, which tsc enforces. Since oxlint 1.73, the import resolver
// follows the specifier past the suffix to the untransformed module. That module exports nothing,
// so oxlint reports a default export that exists only after the transform.
// oxlint-disable-next-line import/namespace -- resolver false positive, see above
const DiffsRenderWorkerUrl = DiffsRenderWorkerUrlModule.default

// On the server, this store lives across the requests of different visitors. Trigger its events only
// from browser code, never during a render.
const workerPoolStore = createWorkerPoolStore({
  scriptUrl: DiffsRenderWorkerUrl,
  reloadWorkerScript: () => reloadWorkerScript({scriptUrl: DiffsRenderWorkerUrl}),
  claimPageReload: () => claimPageReload({assetUrl: DiffsRenderWorkerUrl}),
  reloadPage: () => location.reload(),
  // reportError raises the error like an uncaught one, so it reaches Sentry's onerror handler.
  reportFailure: (description) => reportError(new Error(description)),
})

export function useWorkerPoolState(): WorkerPoolState {
  return useSelector(workerPoolStore, selectWorkerPoolState)
}

export function useWorkerPoolStats(): WorkerStats | undefined {
  return useSelector(workerPoolStore, (snapshot) => snapshot.context.stats, areWorkerStatsEqual)
}

function handleWorkerFailure(event: Event): void {
  // The report below replaces the browser's own report of an uncaught worker error.
  event.preventDefault()
  if (event instanceof ErrorEvent) {
    workerPoolStore.trigger.workerThrew({
      message: event.message,
      description: describeWorkerThrow(event),
    })
    return
  }

  workerPoolStore.trigger.workerLoadFailed()
}

function isMobileBrowser(): boolean {
  const navigator = globalThis.navigator
  if (isNullish(navigator)) {
    return false
  }

  return (
    navigator.maxTouchPoints > 0 &&
    globalThis.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches
  )
}

function getWorkerResourceLimits(): Pick<
  Required<WorkerPoolOptions>,
  'poolSize' | 'totalASTLRUCacheSize'
> {
  return isMobileBrowser()
    ? {poolSize: 1, totalASTLRUCacheSize: 10}
    : {poolSize: 3, totalASTLRUCacheSize: 100}
}

const WorkerResourceLimits = getWorkerResourceLimits()

const PoolOptions: WorkerPoolOptions = {
  // We really shouldn't let the pool get too big...
  poolSize: Math.min(
    Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 1) - 1),
    WorkerResourceLimits.poolSize,
  ),
  totalASTLRUCacheSize: WorkerResourceLimits.totalASTLRUCacheSize,
  workerFactory() {
    // Vite serves the worker as an ES module in dev and bundles it as a classic script for builds.
    return new Worker(DiffsRenderWorkerUrl, {type: import.meta.env.DEV ? 'module' : 'classic'})
  },
  onWorkerError: handleWorkerFailure,
}

const HighlighterOptions: WorkerInitializationRenderOptions = {
  // diffs used to override the default pair with the soft pierre themes;
  // now that the canonical default IS the non-soft pair (shared via theming),
  // every site initializes the pool with the same defaults.
  theme: DEFAULT_THEMES,
  langs: ['rust', 'tsx', 'typescript'],
  preferredHighlighter: 'shiki-wasm',
}

interface WorkerPoolProps {
  children: ReactNode
  highlighterOptions?: WorkerInitializationRenderOptions
  poolOptions?: WorkerPoolOptions
}

export function WorkerPoolContext({
  children,
  highlighterOptions = HighlighterOptions,
  poolOptions = PoolOptions,
}: WorkerPoolProps) {
  return (
    <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
      <PoolStoreConnection langs={highlighterOptions.langs} />
      {children}
    </WorkerPoolContextProvider>
  )
}

interface PoolStoreConnectionProps {
  langs: WorkerInitializationRenderOptions['langs']
}

// Sends the stats of the pool to the store, and gives the store a way to start the pool again with
// the same languages.
function PoolStoreConnection({langs}: PoolStoreConnectionProps) {
  const workerPool = useWorkerPool()
  useEffect(() => {
    if (isNullish(workerPool)) {
      return undefined
    }
    workerPoolStore.trigger.poolAttached({restartPool: () => workerPool.initialize(langs)})
    const unsubscribe = workerPool.subscribeToStatChanges((stats) => {
      workerPoolStore.trigger.poolStatsChanged({stats})
    })
    return () => {
      unsubscribe()
      workerPoolStore.trigger.poolDetached()
    }
  }, [langs, workerPool])
  return null
}
