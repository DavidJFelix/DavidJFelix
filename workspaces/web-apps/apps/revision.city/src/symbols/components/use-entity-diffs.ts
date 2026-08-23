import {useEffect, useRef, useState} from 'react'

import type {EntityDiff} from '@/symbols/lib/entity'
import {
  type EntityDiffRequest,
  MAX_FILES_PER_REQUEST,
  streamEntityDiffs,
} from '@/symbols/lib/entity-diff-client'

export type EntityDiffStatus = 'pending' | 'loading' | 'ready' | 'error'

export interface EntityDiffEntry {
  readonly diff?: EntityDiff
  readonly error?: string
  readonly itemId: string
  readonly name: string
  readonly status: EntityDiffStatus
}

export interface UseEntityDiffsParams {
  // Gates the whole thing: nothing is requested until the symbols tab is opened,
  // so viewing a diff without opening the tab costs nothing.
  enabled: boolean
  requests: readonly EntityDiffRequest[]
  sourcePath: string
}

export interface EntityDiffsState {
  readonly entries: readonly EntityDiffEntry[]
  readonly loadedCount: number
  readonly totalCount: number
}

export function useEntityDiffs({
  enabled,
  requests,
  sourcePath,
}: UseEntityDiffsParams): EntityDiffsState {
  const [entries, setEntries] = useState<readonly EntityDiffEntry[]>([])
  // Results survive tab switches and streamed additions to the file list; the
  // key pins a result to one revision pair so it can never be shown for another.
  const cacheRef = useRef(new Map<string, EntityDiffEntry>())
  const previousSourceRef = useRef(sourcePath)

  useEffect(() => {
    if (previousSourceRef.current !== sourcePath) {
      previousSourceRef.current = sourcePath
      cacheRef.current = new Map()
    }
  })

  useEffect(() => {
    if (!enabled || requests.length === 0) {
      return undefined
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
      // subrequest budget, and each file costs up to two GitHub reads.
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
          await streamEntityDiffs({
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
            // Unmounted or re-run: drop in-flight markers so a later pass retries.
            for (const request of batch) {
              cache.delete(cacheKey(request))
            }
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
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, requests, sourcePath])

  return {
    entries,
    loadedCount: entries.filter((entry) => entry.status === 'ready').length,
    totalCount: entries.length,
  }
}

// Includes prevName and type because a rename changes which blobs are compared
// while the file's name stays the same.
function cacheKey(request: EntityDiffRequest): string {
  return `${request.type}\0${request.prevName ?? ''}\0${request.name}`
}
