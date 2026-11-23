import {createStoreLogic, type InferSchemaPayloadMap, type TriggerObject} from '@xstate/store'
import * as z from 'zod/mini'

import type {SymbolDiff} from '@/symbols/lib/code-symbol'
import {
  MAX_FILES_PER_REQUEST,
  type SymbolDiffRequest,
  type SymbolDiffStreamResult,
  streamSymbolDiffs,
} from '@/symbols/lib/symbol-diff-client'

const symbolDiffRequestSchema = z.custom<SymbolDiffRequest>()

const symbolDiffEntryShape = {
  diff: z.optional(z.custom<SymbolDiff>()),
  error: z.optional(z.string()),
  itemId: z.string(),
  name: z.string(),
}

const symbolDiffEntrySchema = z.readonly(
  z.object({...symbolDiffEntryShape, status: z.enum(['pending', 'loading', 'ready', 'error'])}),
)

const settledEntrySchema = z.readonly(
  z.object({...symbolDiffEntryShape, status: z.enum(['ready', 'error'])}),
)

const symbolDiffsInputShape = {
  domain: z.optional(z.string()),
  sourcePath: z.string(),
}

const symbolDiffsInputSchema = z.readonly(z.object(symbolDiffsInputShape))

const symbolDiffBatchSchema = z.readonly(
  z.object({
    controller: z.instanceof(AbortController),
    id: z.number(),
    unanswered: z.readonly(z.array(symbolDiffRequestSchema)),
  }),
)

const symbolDiffsDataShape = {
  ...symbolDiffsInputShape,
  batchCount: z.number(),
  requests: z.readonly(z.array(symbolDiffRequestSchema)),
  // A new file list keeps these results, and a new source clears them.
  results: z.readonly(z.map(z.string(), settledEntrySchema)),
}

// `stopped` sends nothing. `idle` sends a batch as soon as a file is pending.
const symbolDiffsContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({
      ...symbolDiffsDataShape,
      batch: z.optional(z.undefined()),
      status: z.enum(['stopped', 'idle']),
    }),
    z.object({...symbolDiffsDataShape, batch: symbolDiffBatchSchema, status: z.literal('reading')}),
  ]),
)

const symbolDiffsEventSchemas = {
  requestsChanged: z.object({requests: z.readonly(z.array(symbolDiffRequestSchema))}),
  batchStarted: z.object({}),
  resultArrived: z.object({batchId: z.number(), result: z.custom<SymbolDiffStreamResult>()}),
  streamEnded: z.object({batchId: z.number()}),
  batchFailed: z.object({batchId: z.number(), error: z.string()}),
  aborted: z.object({}),
  retried: z.object({}),
  sourceChanged: symbolDiffsInputSchema,
}

export type SymbolDiffEntry = z.infer<typeof symbolDiffEntrySchema>

export type SymbolDiffStatus = SymbolDiffEntry['status']

export type SymbolDiffsInput = z.infer<typeof symbolDiffsInputSchema>

export type SymbolDiffsContext = z.infer<typeof symbolDiffsContextSchema>

type SymbolDiffBatch = z.infer<typeof symbolDiffBatchSchema>

type SettledEntry = z.infer<typeof settledEntrySchema>

type ReadingContext = Extract<SymbolDiffsContext, {status: 'reading'}>

interface ReadBatchParams extends SymbolDiffsInput {
  batch: SymbolDiffBatch
  trigger: TriggerObject<InferSchemaPayloadMap<typeof symbolDiffsEventSchemas>>
}

export const symbolDiffsLogic = createStoreLogic({
  schemas: {context: symbolDiffsContextSchema, events: symbolDiffsEventSchemas},
  context: ({domain, sourcePath}: SymbolDiffsInput): SymbolDiffsContext => ({
    batchCount: 0,
    domain,
    requests: [],
    results: new Map(),
    sourcePath,
    status: 'stopped',
  }),
  selectors: {entries: listEntries},
  on: {
    requestsChanged: (context, {requests}, enqueue) => {
      enqueue.trigger.batchStarted()
      return context.status === 'stopped'
        ? {...context, requests, status: 'idle'}
        : {...context, requests}
    },
    batchStarted: (context, _event, enqueue) => {
      const files =
        context.status === 'idle' ? pendingRequests(context).slice(0, MAX_FILES_PER_REQUEST) : []
      if (files.length === 0) {
        return undefined
      }
      const batch = {
        controller: new AbortController(),
        id: context.batchCount + 1,
        unanswered: files,
      }
      const {domain, sourcePath} = context
      enqueue.effect(({trigger}) => {
        readBatch({batch, domain, sourcePath, trigger})
      })
      return {...context, batch, batchCount: batch.id, status: 'reading'}
    },
    resultArrived: (context, {batchId, result}) => {
      if (!isCurrentBatch(context, batchId)) {
        return undefined
      }
      const request = context.batch.unanswered.find((file) => file.itemId === result.itemId)
      if (request === undefined) {
        return undefined
      }
      const entry: SettledEntry = {
        itemId: result.itemId,
        name: result.name,
        status: result.diff === undefined ? 'error' : 'ready',
        diff: result.diff,
        error: result.error,
      }
      return {
        ...context,
        batch: {
          ...context.batch,
          unanswered: context.batch.unanswered.filter((file) => file !== request),
        },
        results: new Map(context.results).set(resultKey(request), entry),
      }
    },
    streamEnded: (context, {batchId}, enqueue) => {
      if (!isCurrentBatch(context, batchId)) {
        return undefined
      }
      enqueue.trigger.batchStarted()
      return failUnanswered(context, 'No result for this file.')
    },
    batchFailed: (context, {batchId, error}, enqueue) => {
      if (!isCurrentBatch(context, batchId)) {
        return undefined
      }
      enqueue.trigger.batchStarted()
      return failUnanswered(context, error)
    },
    aborted: (context, _event, enqueue) => {
      if (context.status === 'stopped') {
        return undefined
      }
      const {batch} = context
      if (batch !== undefined) {
        enqueue.effect(() => {
          batch.controller.abort()
        })
      }
      return {...context, batch: undefined, status: 'stopped'}
    },
    retried: (context, _event, enqueue) => {
      const results = new Map([...context.results].filter(([, entry]) => entry.status !== 'error'))
      if (results.size === context.results.size) {
        return undefined
      }
      enqueue.trigger.batchStarted()
      return {...context, results}
    },
    sourceChanged: (context, {domain, sourcePath}, enqueue) => {
      if (domain === context.domain && sourcePath === context.sourcePath) {
        return undefined
      }
      const {batch} = context
      if (batch !== undefined) {
        enqueue.effect(() => {
          batch.controller.abort()
        })
      }
      enqueue.trigger.batchStarted()
      return {
        ...context,
        batch: undefined,
        domain,
        results: new Map(),
        sourcePath,
        status: context.status === 'stopped' ? 'stopped' : 'idle',
      }
    },
  },
})

export function listEntries(context: SymbolDiffsContext): readonly SymbolDiffEntry[] {
  const unanswered = new Set(context.batch?.unanswered.map(resultKey))
  return context.requests.map((request) => {
    const key = resultKey(request)
    return (
      context.results.get(key) ?? {
        itemId: request.itemId,
        name: request.name,
        status: unanswered.has(key) ? 'loading' : 'pending',
      }
    )
  })
}

function readBatch({batch, domain, sourcePath, trigger}: ReadBatchParams): void {
  const batchId = batch.id
  void streamSymbolDiffs({
    domain,
    files: batch.unanswered,
    signal: batch.controller.signal,
    sourcePath,
    onResult: (result) => {
      trigger.resultArrived({batchId, result})
    },
  }).then(
    () => {
      trigger.streamEnded({batchId})
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Symbol lookup failed.'
      trigger.batchFailed({batchId, error: message})
    },
  )
}

function pendingRequests(context: SymbolDiffsContext): readonly SymbolDiffRequest[] {
  return context.requests.filter((request) => !context.results.has(resultKey(request)))
}

function isCurrentBatch(context: SymbolDiffsContext, batchId: number): context is ReadingContext {
  return context.status === 'reading' && context.batch.id === batchId
}

function failUnanswered(context: ReadingContext, error: string): SymbolDiffsContext {
  const results = new Map(context.results)
  for (const file of context.batch.unanswered) {
    results.set(resultKey(file), {itemId: file.itemId, name: file.name, status: 'error', error})
  }
  return {...context, batch: undefined, results, status: 'idle'}
}

// A later request for the same `name` can have a different `prevName` or `type`,
// and then the diff compares other blobs. So the key holds all three.
function resultKey(request: SymbolDiffRequest): string {
  return `${request.type}\0${request.prevName ?? ''}\0${request.name}`
}
