import {useSelector, useStore} from '@xstate/store-react'
import {useCallback, useEffect} from 'react'

import type {SymbolDiffRequest} from '@/symbols/lib/symbol-diff-client'
import {type SymbolDiffEntry, symbolDiffsLogic} from '@/symbols/state/symbol-diffs-store'

export type {SymbolDiffEntry, SymbolDiffStatus} from '@/symbols/state/symbol-diffs-store'

export interface UseSymbolDiffsParams {
  domain?: string
  // Gates the whole thing: nothing is requested until the symbols tab is opened,
  // so viewing a diff without opening the tab costs nothing.
  enabled: boolean
  requests: readonly SymbolDiffRequest[]
  sourcePath: string
}

export interface SymbolDiffsState {
  readonly entries: readonly SymbolDiffEntry[]
  readonly loadedCount: number
  // Asks again for the files that failed, and only for those.
  readonly retry: () => void
  readonly totalCount: number
}

export function useSymbolDiffs({
  domain,
  enabled,
  requests,
  sourcePath,
}: UseSymbolDiffsParams): SymbolDiffsState {
  const store = useStore(symbolDiffsLogic, {domain, sourcePath})
  const entries = useSelector(store.selectors.entries)

  useEffect(() => {
    store.trigger.sourceChanged({domain, sourcePath})
  }, [domain, sourcePath, store])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    store.trigger.requestsChanged({requests})
    return () => {
      store.trigger.aborted()
    }
  }, [enabled, requests, store])

  const retry = useCallback(() => {
    store.trigger.retried()
  }, [store])

  return {
    entries,
    loadedCount: entries.filter((entry) => entry.status === 'ready').length,
    retry,
    totalCount: entries.length,
  }
}
