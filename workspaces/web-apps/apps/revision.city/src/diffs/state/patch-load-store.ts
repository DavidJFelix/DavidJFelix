import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import type {GitHubAccessRemedy} from '@/diffs/lib/github-access-remedy'

const githubAccessRemedySchema = z.custom<GitHubAccessRemedy>()

const streamPublishPhaseSchema = z.enum(['none', 'tree', 'initial-items'])

const patchLoadErrorSchema = z.readonly(
  z.object({message: z.string(), remedy: z.nullable(githubAccessRemedySchema)}),
)

const patchLoadRequestShape = {
  loadAttempt: z.number(),
  requestId: z.number(),
}

const statusOnlyPhaseShape = {status: z.enum(['fetching', 'parsing', 'ready'])}

const streamingPhaseShape = {
  publishPhase: streamPublishPhaseSchema,
  status: z.literal('streaming'),
}

const errorPhaseShape = {error: patchLoadErrorSchema, status: z.literal('error')}

const patchLoadPhaseSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object(statusOnlyPhaseShape),
    z.object(streamingPhaseShape),
    z.object(errorPhaseShape),
  ]),
)

const patchLoadContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({...patchLoadRequestShape, ...statusOnlyPhaseShape}),
    z.object({...patchLoadRequestShape, ...streamingPhaseShape}),
    z.object({...patchLoadRequestShape, ...errorPhaseShape}),
  ]),
)

const patchRequestEventSchema = z.object({requestId: z.number()})

const patchLoadEventSchemas = {
  loadStarted: z.object({}),
  retryRequested: z.object({}),
  streamOpened: patchRequestEventSchema,
  treePublished: patchRequestEventSchema,
  itemsPublished: patchRequestEventSchema,
  parsingStarted: patchRequestEventSchema,
  loadFinished: patchRequestEventSchema,
  loadFailed: z.object({error: patchLoadErrorSchema, requestId: z.number()}),
}

export type StreamPublishPhase = z.infer<typeof streamPublishPhaseSchema>

export type PatchLoadError = z.infer<typeof patchLoadErrorSchema>

export type PatchLoadContext = z.infer<typeof patchLoadContextSchema>

type PatchLoadPhase = z.infer<typeof patchLoadPhaseSchema>

export const patchLoadLogic = createStoreLogic({
  schemas: {context: patchLoadContextSchema, events: patchLoadEventSchemas},
  context: (): PatchLoadContext => ({loadAttempt: 0, requestId: 0, status: 'fetching'}),
  on: {
    loadStarted: (context) => ({
      loadAttempt: context.loadAttempt,
      requestId: context.requestId + 1,
      status: 'fetching',
    }),
    retryRequested: (context) => {
      if (context.status !== 'error') {
        return undefined
      }
      return {...context, loadAttempt: context.loadAttempt + 1}
    },
    streamOpened: (context, event) => {
      if (event.requestId !== context.requestId || context.status !== 'fetching') {
        return undefined
      }
      return withPhase(context, {status: 'streaming', publishPhase: 'none'})
    },
    treePublished: (context, event) => {
      if (event.requestId !== context.requestId || context.status !== 'streaming') {
        return undefined
      }
      return context.publishPhase === 'none' ? {...context, publishPhase: 'tree'} : context
    },
    itemsPublished: (context, event) => {
      if (event.requestId !== context.requestId || context.status !== 'streaming') {
        return undefined
      }
      return context.publishPhase === 'initial-items'
        ? context
        : {...context, publishPhase: 'initial-items'}
    },
    parsingStarted: (context, event) => {
      const canParse = context.status === 'fetching' || context.status === 'streaming'
      if (event.requestId !== context.requestId || !canParse) {
        return undefined
      }
      return withPhase(context, {status: 'parsing'})
    },
    loadFinished: (context, event) => {
      const canFinish = context.status === 'streaming' || context.status === 'parsing'
      if (event.requestId !== context.requestId || !canFinish) {
        return undefined
      }
      return withPhase(context, {status: 'ready'})
    },
    loadFailed: (context, event) => {
      if (event.requestId !== context.requestId) {
        return undefined
      }
      return withPhase(context, {status: 'error', error: event.error})
    },
  },
})

export function getPublishPhase(context: PatchLoadContext): StreamPublishPhase | undefined {
  return context.status === 'streaming' ? context.publishPhase : undefined
}

function withPhase(context: PatchLoadContext, phase: PatchLoadPhase): PatchLoadContext {
  return {loadAttempt: context.loadAttempt, requestId: context.requestId, ...phase}
}
