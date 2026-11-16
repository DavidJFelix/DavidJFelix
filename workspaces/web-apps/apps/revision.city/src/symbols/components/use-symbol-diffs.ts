import {useCallback, useEffect, useRef, useState} from 'react'

import type {SymbolDiff} from '@/symbols/lib/code-symbol'
import {
  MAX_FILES_PER_REQUEST,
  type SymbolDiffRequest,
  streamSymbolDiffs,
} from '@/symbols/lib/symbol-diff-client'

export type SymbolDiffStatus = 'pending' | 'loading' | 'ready' | 'error'

export interface SymbolDiffEntry {
  readonly diff?: SymbolDiff
  readonly error?: string
  readonly itemId: string
  readonly name: string
  readonly status: SymbolDiffStatus
}

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
  const [entries, setEntries] = useState<readonly SymbolDiffEntry[]>([])
  // Results survive tab switches and streamed additions to the file list; the
  // key pins a result to one revision pair so it can never be shown for another.
  const cacheRef = useRef(new Map<string, SymbolDiffEntry>())
  const sourceKey = `${domain ?? ''}\0${sourcePath}`
  const previousSourceRef = useRef(sourceKey)
  const [attempt, setAttempt] = useState(0)
  const previousAttemptRef = useRef(attempt)

  const retry = useCallback(() => {
    setAttempt((count) => count + 1)
  }, [])

  useEffect(() => {
    if (previousSourceRef.current !== sourceKey) {
      previousSourceRef.current = sourceKey
      cacheRef.current = new Map()
    }
    if (previousAttemptRef.current !== attempt) {
      previousAttemptRef.current = attempt
      for (const [key, entry] of cacheRef.current) {
        if (entry.status === 'error') {
          cacheRef.current.delete(key)
        }
      }
    }

    if (!enabled || requests.length === 0) {
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const cache = cacheRef.current

    const publish = () => {
      if (!cancelled) {
        setEntries(
          requests.map(
            (request) =>
              cache.get(cacheKey(request)) ?? {
                itemId: request.itemId,
                name: request.name,
                status: 'pending',
              },
          ),
        )
      }
    }

    const run = async () => {
      const outstanding = requests.filter(
        (request) => (cache.get(cacheKey(request))?.status ?? 'pending') === 'pending',
      )
      publish()

      // Batched rather than sent whole: one worker request has a bounded
      // subrequest budget, and each file costs up to two file reads.
      for (let index = 0; index < outstanding.length; index += MAX_FILES_PER_REQUEST) {
        if (cancelled) {
          return
        }
        const batch = outstanding.slice(index, index + MAX_FILES_PER_REQUEST)
        for (const request of batch) {
          cache.set(cacheKey(request), {
            itemId: request.itemId,
            name: request.name,
            status: 'loading',
          })
        }
        publish()

        try {
          await streamSymbolDiffs({
            domain,
            files: batch,
            signal: controller.signal,
            sourcePath,
            onResult: (result) => {
              const request = batch.find((candidate) => candidate.itemId === result.itemId)
              if (request === undefined) {
                return
              }
              cache.set(cacheKey(request), {
                itemId: result.itemId,
                name: result.name,
                status: result.diff === undefined ? 'error' : 'ready',
                diff: result.diff,
                error: result.error,
              })
              publish()
            },
          })
        } catch (error) {
          if (controller.signal.aborted) {
            return
          }
          const message = error instanceof Error ? error.message : 'Symbol lookup failed.'
          for (const request of batch) {
            if (cache.get(cacheKey(request))?.status === 'loading') {
              cache.set(cacheKey(request), {
                itemId: request.itemId,
                name: request.name,
                status: 'error',
                error: message,
              })
            }
          }
          publish()
          continue
        }
        // A re-run can start before this run gets here, and its files must not
        // become errors.
        if (cancelled) {
          return
        }
        // Without this, a file that the stream did not answer stays on
        // "Reading" for good.
        for (const request of batch) {
          if (cache.get(cacheKey(request))?.status === 'loading') {
            cache.set(cacheKey(request), {
              itemId: request.itemId,
              name: request.name,
              status: 'error',
              error: 'No result for this file.',
            })
          }
        }
        publish()
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
      // Done here and not in the abort catch, because the next run reads the
      // cache before that catch runs. Results that arrived are kept.
      for (const [key, entry] of cache) {
        if (entry.status === 'loading') {
          cache.delete(key)
        }
      }
    }
  }, [attempt, domain, enabled, requests, sourceKey, sourcePath])

  return {
    entries,
    loadedCount: entries.filter((entry) => entry.status === 'ready').length,
    retry,
    totalCount: entries.length,
  }
}

// Includes prevName and type because a rename changes which blobs are compared
// while the file's name stays the same.
function cacheKey(request: SymbolDiffRequest): string {
  return `${request.type}\0${request.prevName ?? ''}\0${request.name}`
}
