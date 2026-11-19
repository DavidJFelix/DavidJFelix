import {createStoreLogic} from '@xstate/store'

import type {GitHubAccessRemedy} from '@/diffs/lib/github-access-remedy'

export type StreamPublishPhase = 'none' | 'tree' | 'initial-items'

export interface PatchLoadError {
  message: string
  remedy: GitHubAccessRemedy | null
}

interface PatchLoadRequest {
  loadAttempt: number
  requestId: number
}

type PatchLoadPhase =
  | {status: 'fetching' | 'parsing' | 'ready'}
  | {status: 'streaming'; publishPhase: StreamPublishPhase}
  | {status: 'error'; error: PatchLoadError}

export type PatchLoadContext = PatchLoadRequest & PatchLoadPhase

interface PatchRequestEvent {
  requestId: number
}

interface PatchLoadFailedEvent extends PatchRequestEvent {
  error: PatchLoadError
}

export const patchLoadLogic = createStoreLogic({
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
    streamOpened: (context, event: PatchRequestEvent) => {
      if (event.requestId !== context.requestId || context.status !== 'fetching') {
        return undefined
      }
      return withPhase(context, {status: 'streaming', publishPhase: 'none'})
    },
    treePublished: (context, event: PatchRequestEvent) => {
      if (event.requestId !== context.requestId || context.status !== 'streaming') {
        return undefined
      }
      return context.publishPhase === 'none' ? {...context, publishPhase: 'tree'} : context
    },
    itemsPublished: (context, event: PatchRequestEvent) => {
      if (event.requestId !== context.requestId || context.status !== 'streaming') {
        return undefined
      }
      return context.publishPhase === 'initial-items'
        ? context
        : {...context, publishPhase: 'initial-items'}
    },
    parsingStarted: (context, event: PatchRequestEvent) => {
      const canParse = context.status === 'fetching' || context.status === 'streaming'
      if (event.requestId !== context.requestId || !canParse) {
        return undefined
      }
      return withPhase(context, {status: 'parsing'})
    },
    loadFinished: (context, event: PatchRequestEvent) => {
      const canFinish = context.status === 'streaming' || context.status === 'parsing'
      if (event.requestId !== context.requestId || !canFinish) {
        return undefined
      }
      return withPhase(context, {status: 'ready'})
    },
    loadFailed: (context, event: PatchLoadFailedEvent) => {
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
