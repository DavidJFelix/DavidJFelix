import {createStoreLogic} from '@xstate/store'

import {baseMovedOnText} from '@/diffs/lib/base-moved-on-text'
import {isNullish} from '@/diffs/lib/nullish'

const COMPARE_STATUS_ENDPOINT = '/api/diffs/github-compare-status'

export type BaseMovedOnContext =
  | {status: 'idle'; requestId: number}
  | {status: 'loading'; requestId: number; path: string}
  | {status: 'answered'; requestId: number; path: string; notice: string | undefined}

interface CompareStatusRequest {
  path: string
  range: string
}

interface CompareStatusAnswer {
  requestId: number
  notice: string | undefined
}

export const baseMovedOnLogic = createStoreLogic({
  context: (): BaseMovedOnContext => ({status: 'idle', requestId: 0}),
  on: {
    requested: (context, {path, range}: CompareStatusRequest, enqueue): BaseMovedOnContext => {
      const requestId = context.requestId + 1
      enqueue.effect(({trigger}) => {
        void fetchBehindBy(path).then((behindBy) => {
          trigger.answered({
            requestId,
            notice:
              !isNullish(behindBy) && behindBy > 0 ? baseMovedOnText({range, behindBy}) : undefined,
          })
        })
      })
      return {status: 'loading', requestId, path}
    },
    answered: (context, {requestId, notice}: CompareStatusAnswer): BaseMovedOnContext | undefined =>
      context.status === 'loading' && context.requestId === requestId
        ? {...context, status: 'answered', notice}
        : undefined,
  },
})

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
