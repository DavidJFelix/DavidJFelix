import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

export class VectorStoreError extends Data.TaggedError('VectorStoreError')<{
  readonly op: 'query' | 'upsert'
  readonly cause: unknown
}> {}

export interface VectorMatch {
  readonly id: string
  readonly score: number
  readonly metadata?: unknown
}

export interface VectorStore {
  readonly query: (
    vector: number[],
    opts?: { topK?: number; filter?: Record<string, unknown> },
  ) => Effect.Effect<ReadonlyArray<VectorMatch>, VectorStoreError>
  readonly upsert: (
    vectors: ReadonlyArray<{ id: string; values: number[]; metadata?: unknown }>,
  ) => Effect.Effect<{ count: number }, VectorStoreError>
}

export const VectorStore = Context.GenericTag<VectorStore>('@f311x/VectorStore')

export const VectorStoreLive = (env: Env) =>
  Layer.succeed(
    VectorStore,
    VectorStore.of({
      query: (vector, opts) =>
        Effect.tryPromise({
          try: async () => {
            const res = await env.KNOWLEDGE.query(vector, opts)
            return res.matches
          },
          catch: (cause) => new VectorStoreError({ op: 'query', cause }),
        }),
      upsert: (vectors) =>
        Effect.tryPromise({
          try: () => env.KNOWLEDGE.upsert([...vectors]),
          catch: (cause) => new VectorStoreError({ op: 'upsert', cause }),
        }),
    }),
  )
