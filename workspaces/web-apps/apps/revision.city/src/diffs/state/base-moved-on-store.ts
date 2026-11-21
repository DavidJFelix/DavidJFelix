import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {baseMovedOnText} from '@/diffs/lib/base-moved-on-text'
import {isNullish} from '@/diffs/lib/nullish'

const COMPARE_STATUS_ENDPOINT = '/api/diffs/github-compare-status'

const noticeSchema = z.union([z.string(), z.undefined()])

const baseMovedOnContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({status: z.literal('idle'), requestId: z.number()}),
    z.object({status: z.literal('loading'), requestId: z.number(), path: z.string()}),
    z.object({
      status: z.literal('answered'),
      requestId: z.number(),
      path: z.string(),
      notice: noticeSchema,
    }),
  ]),
)

const baseMovedOnEventSchemas = {
  requested: z.object({path: z.string(), range: z.string()}),
  answered: z.object({requestId: z.number(), notice: noticeSchema}),
}

export type BaseMovedOnContext = z.infer<typeof baseMovedOnContextSchema>

export const baseMovedOnLogic = createStoreLogic({
  schemas: {context: baseMovedOnContextSchema, events: baseMovedOnEventSchemas},
  context: (): BaseMovedOnContext => ({status: 'idle', requestId: 0}),
  on: {
    requested: (context, {path, range}, enqueue): BaseMovedOnContext => {
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
    answered: (context, {requestId, notice}): BaseMovedOnContext | undefined =>
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
