// cSpell:ignore ASTLRU -- worker pool option name from @pierre/diffs
import {DEFAULT_THEMES} from '@pierre/diffs'
import {
  type WorkerInitializationRenderOptions,
  WorkerPoolContextProvider,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
// Vite bundles the highlight worker and its shiki/wasm imports into a dedicated worker chunk.
// The import gives the URL of that chunk. `workerFactory` below constructs the worker, only in
// the browser.
import * as DiffsRenderWorkerUrlModule from '@pierre/diffs/worker/worker.js?worker&url'
import type {ReactNode} from 'react'
import {isNullish} from '@/diffs/lib/nullish'
import {describeWorkerFailure} from '@/diffs/lib/worker-failure'

// Vite's ?worker transform creates the default export, and vite/client types it with
// `declare module '*?worker&url'`, which tsc enforces. Since oxlint 1.73, the import resolver
// follows the specifier past the suffix to the untransformed module. That module exports nothing,
// so oxlint reports a default export that exists only after the transform.
// oxlint-disable-next-line import/namespace -- resolver false positive, see above
const DiffsRenderWorkerUrl = DiffsRenderWorkerUrlModule.default

// Every worker in the pool sends the same load failure, so the page reports each failure only once.
const reportedWorkerFailures = new Set<string>()

function reportWorkerFailure(event: Event): void {
  // The report below replaces the browser's own report of an uncaught worker error.
  event.preventDefault()
  const failureKey = event instanceof ErrorEvent ? event.message : event.type
  if (reportedWorkerFailures.has(failureKey)) {
    return
  }

  reportedWorkerFailures.add(failureKey)
  // reportError raises the error like an uncaught one, so it reaches Sentry's onerror handler.
  void describeWorkerFailure({event, scriptUrl: DiffsRenderWorkerUrl}).then((description) =>
    reportError(new Error(description)),
  )
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
  onWorkerError: reportWorkerFailure,
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
      {children}
    </WorkerPoolContextProvider>
  )
}
