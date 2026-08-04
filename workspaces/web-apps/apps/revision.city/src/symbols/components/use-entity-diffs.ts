import {useCallback, useEffect, useRef, useState} from 'react'

import type {EntityDiff} from '@/symbols/lib/entity'
import {type EntityDiffRequest, fetchEntityDiff} from '@/symbols/lib/entity-diff-client'

// Each file costs up to two GitHub blob fetches, so requests are spread rather
// than fired at once -- a 60-file PR would otherwise open 60 connections and
// burn through the rate limit in one burst.
const MAX_CONCURRENT_REQUESTS = 4

export type EntityDiffStatus = 'pending' | 'loading' | 'ready' | 'error'

export interface EntityDiffEntry {
  readonly diff?: EntityDiff
  readonly error?: string
  readonly itemId: string
  readonly name: string
  readonly status: EntityDiffStatus
}

export interface UseEntityDiffsParams {
  // Gates every request: nothing is fetched until the symbols tab is opened, so
  // viewing a diff without opening the tab costs nothing.
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

  if (previousSourceRef.current !== sourcePath) {
    previousSourceRef.current = sourcePath
    cacheRef.current = new Map()
  }

  const readCached = useCallback(
    (request: EntityDiffRequest): EntityDiffEntry =>
      cacheRef.current.get(cacheKey(request)) ?? {
        itemId: request.itemId,
        name: request.name,
        status: 'pending',
      },
    [],
  )

  useEffect(() => {
    if (!enabled || requests.length === 0) {
      return undefined
    }

    const controller = new AbortController()
    let cancelled = false

    const publish = () => {
      if (!cancelled) {
        setEntries(requests.map(readCached))
      }
    }
    publish()

    const queue = requests.filter((request) => readCached(request).status === 'pending')
    const runWorker = async () => {
      while (queue.length > 0 && !cancelled) {
        const request = queue.shift()
        if (request === undefined) {
          return
        }
        const key = cacheKey(request)
        cacheRef.current.set(key, {
          itemId: request.itemId,
          name: request.name,
          status: 'loading',
        })
        publish()

        try {
          const diff = await fetchEntityDiff({request, sourcePath, signal: controller.signal})
          cacheRef.current.set(key, {
            itemId: request.itemId,
            name: request.name,
            status: 'ready',
            diff,
          })
        } catch (error) {
          if (controller.signal.aborted) {
            // Unmounted or re-run: drop the in-flight marker so a later pass retries.
            cacheRef.current.delete(key)
            return
          }
          cacheRef.current.set(key, {
            itemId: request.itemId,
            name: request.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Symbol lookup failed.',
          })
        }
        publish()
      }
    }

    void Promise.all(
      Array.from({length: Math.min(MAX_CONCURRENT_REQUESTS, queue.length)}, runWorker),
    )

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, readCached, requests, sourcePath])

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
