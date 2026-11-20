import {useSelector, useStore} from '@xstate/store-react'
import {useEffect} from 'react'

import {parseGitHubDiffSource} from '@/diffs/lib/github-diff-source'
import {isNullish} from '@/diffs/lib/nullish'
import {baseMovedOnLogic} from '@/diffs/state/base-moved-on-store'

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
  const store = useStore(baseMovedOnLogic)
  const source = isNullish(domain) ? parseGitHubDiffSource(path) : undefined
  // Undefined when the view gets no count, so a notice kept from an earlier view does not show.
  const range = signedIn && source?.kind === 'compare' ? source.range : undefined
  // Until the effect requests a new path, the store holds the answer for the old path.
  const notice = useSelector(store, ({context}) =>
    context.status === 'answered' && context.path === path ? context.notice : undefined,
  )

  useEffect(() => {
    if (!isNullish(range)) {
      store.trigger.requested({path, range})
    }
  }, [path, range, store])

  return isNullish(range) ? undefined : notice
}
