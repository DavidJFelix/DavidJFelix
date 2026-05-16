// Worker binding for the VectorizeIndex custom resource. Mirrors the
// shape of `Cloudflare.KVNamespaceBinding` / `Cloudflare.HyperdriveBinding`.

import type * as runtime from '@cloudflare/workers-types'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Binding from 'alchemy/Binding'
import type { ResourceLike } from 'alchemy/Resource'
import { isWorker, WorkerEnvironment } from 'alchemy/Cloudflare'
import type { VectorizeIndex } from './VectorizeIndex.ts'

export class VectorizeIndexError extends Data.TaggedError('VectorizeIndexError')<{
  message: string
  cause: unknown
}> {}

export interface VectorizeIndexClient {
  /**
   * The raw runtime `Vectorize` binding for callers that want direct
   * access (e.g. to use SDK-specific options not exposed here).
   */
  raw: Effect.Effect<runtime.Vectorize, never, WorkerEnvironment>

  describe: () => Effect.Effect<
    runtime.VectorizeIndexInfo,
    VectorizeIndexError,
    WorkerEnvironment
  >

  query: (
    vector: number[] | runtime.VectorFloatArray,
    options?: runtime.VectorizeQueryOptions,
  ) => Effect.Effect<
    runtime.VectorizeMatches,
    VectorizeIndexError,
    WorkerEnvironment
  >

  insert: (
    vectors: runtime.VectorizeVector[],
  ) => Effect.Effect<
    runtime.VectorizeAsyncMutation,
    VectorizeIndexError,
    WorkerEnvironment
  >

  upsert: (
    vectors: runtime.VectorizeVector[],
  ) => Effect.Effect<
    runtime.VectorizeAsyncMutation,
    VectorizeIndexError,
    WorkerEnvironment
  >

  deleteByIds: (
    ids: string[],
  ) => Effect.Effect<
    runtime.VectorizeAsyncMutation,
    VectorizeIndexError,
    WorkerEnvironment
  >

  getByIds: (
    ids: string[],
  ) => Effect.Effect<
    runtime.VectorizeVector[],
    VectorizeIndexError,
    WorkerEnvironment
  >
}

export class VectorizeIndexBinding extends Binding.Service<
  VectorizeIndexBinding,
  (index: VectorizeIndex) => Effect.Effect<VectorizeIndexClient>
>()('F311x.Cloudflare.VectorizeIndex') {}

export const VectorizeIndexBindingLive = Layer.effect(
  VectorizeIndexBinding,
  Effect.gen(function* () {
    const bind = yield* VectorizeIndexBindingPolicy

    return Effect.fn(function* (index: VectorizeIndex) {
      yield* bind(index)

      const raw = WorkerEnvironment.pipe(
        Effect.map(
          (env) => (env as Record<string, runtime.Vectorize>)[index.LogicalId]!,
        ),
      )

      const tryPromise = <T>(
        fn: () => Promise<T>,
      ): Effect.Effect<T, VectorizeIndexError> =>
        Effect.tryPromise({
          try: fn,
          catch: (error: any) =>
            new VectorizeIndexError({
              message: error?.message ?? 'Unknown Vectorize error',
              cause: error,
            }),
        })

      const use = <T>(
        fn: (raw: runtime.Vectorize) => Promise<T>,
      ): Effect.Effect<T, VectorizeIndexError, WorkerEnvironment> =>
        raw.pipe(Effect.flatMap((r) => tryPromise(() => fn(r))))

      return {
        raw,
        describe: () => use((r) => r.describe()),
        query: (vector, options) => use((r) => r.query(vector, options)),
        insert: (vectors) => use((r) => r.insert(vectors)),
        upsert: (vectors) => use((r) => r.upsert(vectors)),
        deleteByIds: (ids) => use((r) => r.deleteByIds(ids)),
        getByIds: (ids) => use((r) => r.getByIds(ids)),
      } satisfies VectorizeIndexClient
    })
  }),
)

export class VectorizeIndexBindingPolicy extends Binding.Policy<
  VectorizeIndexBindingPolicy,
  (index: VectorizeIndex) => Effect.Effect<void>
>()('F311x.Cloudflare.VectorizeIndex') {}

export const VectorizeIndexBindingPolicyLive =
  VectorizeIndexBindingPolicy.layer.succeed(
    Effect.fn(function* (host: ResourceLike, index: VectorizeIndex) {
      if (!isWorker(host)) {
        return yield* Effect.die(
          new Error(
            `VectorizeIndexBinding does not support runtime '${host.Type}'`,
          ),
        )
      }
      yield* host.bind`${index}`({
        bindings: [
          {
            type: 'vectorize',
            name: index.LogicalId,
            indexName: index.indexName as unknown as string,
          },
        ],
      })
    }),
  )
