// cSpell:ignore ASTLRU -- worker pool option name from @pierre/diffs
import {DEFAULT_THEMES} from '@pierre/diffs'
import {
  type WorkerInitializationRenderOptions,
  WorkerPoolContextProvider,
  type WorkerPoolOptions,
} from '@pierre/diffs/react'
// Vite bundles the highlight worker (and its shiki/wasm imports) into a
// dedicated worker chunk; the import gives back a Worker constructor. Only
// constructed in the browser via workerFactory below.
import * as DiffsRenderWorkerModule from '@pierre/diffs/worker/worker.js?worker'
import type {ReactNode} from 'react'
import {isNullish} from '@/diffs/lib/nullish'

function isMobileBrowser(): boolean {
  const navigator = globalThis.navigator
  if (isNullish(navigator)) {
    return false
  }

  return (
    navigator.maxTouchPoints > 0 &&
    globalThis.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches === true
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
    return new DiffsRenderWorkerModule.default()
  },
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
