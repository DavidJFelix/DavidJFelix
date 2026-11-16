import {useEffect, useState} from 'react'

import {baseMovedOnText} from '@/diffs/lib/base-moved-on-text'
import {parseGitHubDiffSource} from '@/diffs/lib/github-diff-source'
import {isNullish} from '@/diffs/lib/nullish'

const COMPARE_STATUS_ENDPOINT = '/api/diffs/github-compare-status'

interface UseBaseMovedOnParams {
  // Set for an alternate domain, whose compares get no count.
  domain?: string
  path: string
  // The count needs the visitor's GitHub session, as file expansion does.
  signedIn: boolean
}

// Returns a notice when a GitHub compare's base branch moved on after the merge
// base, and undefined otherwise. The notice is a nicety, so a failed lookup
// shows nothing.
export function useBaseMovedOn({domain, path, signedIn}: UseBaseMovedOnParams): string | undefined {
  // The answer keeps the path it is for, so a new path shows nothing until its own answer.
  const [answer, setAnswer] = useState<{path: string; notice: string} | undefined>(undefined)
  const source = isNullish(domain) ? parseGitHubDiffSource(path) : undefined
  // Undefined when the view gets no count, so a notice kept from an earlier view does not show.
  const range = signedIn && source?.kind === 'compare' ? source.range : undefined

  useEffect(() => {
    let cancelled = false
    if (!isNullish(range)) {
      void fetchBehindBy(path).then((behindBy) => {
        if (!cancelled && !isNullish(behindBy) && behindBy > 0) {
          setAnswer({path, notice: baseMovedOnText({range, behindBy})})
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [path, range])

  return !isNullish(range) && answer?.path === path ? answer.notice : undefined
}

async function fetchBehindBy(path: string): Promise<number | undefined> {
  try {
    const response = await fetch(`${COMPARE_STATUS_ENDPOINT}?${new URLSearchParams({path})}`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      return undefined
    }
    const body: unknown = await response.json()
    return typeof body === 'object' &&
      body !== null &&
      'behindBy' in body &&
      typeof body.behindBy === 'number'
      ? body.behindBy
      : undefined
  } catch {
    return undefined
  }
}
