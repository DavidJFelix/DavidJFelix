// cSpell:ignore ASTLRU -- worker pool option name from @pierre/diffs
import {DEFAULT_THEMES} from '@pierre/diffs'
import {
  useWorkerPool,
  type WorkerInitializationRenderOptions,
  WorkerPoolContextProvider,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
// Vite bundles the highlight worker and its shiki/wasm imports into a dedicated worker chunk.
// The import gives the URL of that chunk. `workerFactory` below constructs the worker, only in
// the browser.
import * as DiffsRenderWorkerUrlModule from '@pierre/diffs/worker/worker.js?worker&url'
import {type ReactNode, useEffect, useSyncExternalStore} from 'react'
import {isNullish} from '@/diffs/lib/nullish'
import {
  chooseWorkerRecovery,
  describeWorkerLoadFailure,
  describeWorkerThrow,
  reloadWorkerScript,
  type WorkerRecovery,
} from '@/diffs/lib/worker-failure'
import {claimPageReload} from '@/lib/claim-page-reload'

// Vite's ?worker transform creates the default export, and vite/client types it with
// `declare module '*?worker&url'`, which tsc enforces. Since oxlint 1.73, the import resolver
// follows the specifier past the suffix to the untransformed module. That module exports nothing,
// so oxlint reports a default export that exists only after the transform.
// oxlint-disable-next-line import/namespace -- resolver false positive, see above
const DiffsRenderWorkerUrl = DiffsRenderWorkerUrlModule.default

// Every worker in the pool sends the same load failure, so the page reports each failure only once.
// This also limits the page to one recovery: a second load failure has the same key.
const reportedWorkerFailures = new Set<string>()

// While the page recovers from a load failure, the review UI holds the viewer as if the pool is
// still starting. A viewer that mounts without the pool keeps the main thread highlighter after the
// pool works again.
let recoveringFromLoadFailure = false
const recoveryListeners = new Set<() => void>()
let restartPool: (() => Promise<void>) | undefined

function setRecoveringFromLoadFailure(recovering: boolean): void {
  recoveringFromLoadFailure = recovering
  for (const listener of recoveryListeners) listener()
}

function subscribeToRecovery(listener: () => void): () => void {
  recoveryListeners.add(listener)
  return () => {
    recoveryListeners.delete(listener)
  }
}

export function useWorkerPoolRecovering(): boolean {
  return useSyncExternalStore(
    subscribeToRecovery,
    () => recoveringFromLoadFailure,
    () => false,
  )
}

function handleWorkerFailure(event: Event): void {
  // The report below replaces the browser's own report of an uncaught worker error.
  event.preventDefault()
  const failureKey = event instanceof ErrorEvent ? event.message : event.type
  if (reportedWorkerFailures.has(failureKey)) {
    return
  }

  reportedWorkerFailures.add(failureKey)
  if (event instanceof ErrorEvent) {
    reportWorkerFailure(describeWorkerThrow(event))
    return
  }

  setRecoveringFromLoadFailure(true)
  void recoverFromLoadFailure()
}

async function recoverFromLoadFailure(): Promise<void> {
  const reload = await reloadWorkerScript({scriptUrl: DiffsRenderWorkerUrl})
  const recovery = confirmRecovery(chooseWorkerRecovery(reload))
  reportWorkerFailure(
    describeWorkerLoadFailure({scriptUrl: DiffsRenderWorkerUrl, reload, recovery}),
  )
  if (recovery === 'reload-page') {
    location.reload()
    return
  }

  if (recovery === 'retry-pool') {
    // A failed restart is the second load failure, which the pool reports as failed.
    await restartPool?.().catch(() => undefined)
  }
  setRecoveringFromLoadFailure(false)
}

// A reload needs the reload mark for the script, and a restart needs a mounted pool.
function confirmRecovery(recovery: WorkerRecovery): WorkerRecovery {
  if (recovery === 'reload-page') {
    return claimPageReload({assetUrl: DiffsRenderWorkerUrl}) ? recovery : 'none'
  }
  if (recovery === 'retry-pool') {
    return isNullish(restartPool) ? 'none' : recovery
  }
  return recovery
}

function reportWorkerFailure(description: string): void {
  // reportError raises the error like an uncaught one, so it reaches Sentry's onerror handler.
  reportError(new Error(description))
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
  langs: ['cpp', 'css', 'go', 'python', 'rust', 'sh', 'swift', 'tsx', 'typescript', 'zig'],
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
      <PoolRestart langs={highlighterOptions.langs} />
      {children}
    </WorkerPoolContextProvider>
  )
}

interface PoolRestartProps {
  langs: WorkerInitializationRenderOptions['langs']
}

// Gives the load failure handler a way to start the pool again with the same languages.
function PoolRestart({langs}: PoolRestartProps) {
  const workerPool = useWorkerPool()
  useEffect(() => {
    restartPool = isNullish(workerPool) ? undefined : () => workerPool.initialize(langs)
    return () => {
      restartPool = undefined
    }
  }, [langs, workerPool])
  return null
}
