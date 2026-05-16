// Cloudflare Vectorize index — custom Alchemy v2 resource for f311x.
//
// Vectorize is not yet a first-party resource in `alchemy/Cloudflare`. This
// file fills the gap, following the patterns documented at
// https://v2.alchemy.run/guides/custom-provider/ and modelled on the
// existing `Cloudflare.KVNamespace` / `Cloudflare.Hyperdrive` providers.
//
// Vectorize indexes are immutable once created — `dimensions`, `metric`,
// `preset`, `name`, and `description` are all set-on-create. The `diff`
// hook therefore returns `{ action: "replace" }` on any prop drift.

import * as vectorize from '@distilled.cloud/cloudflare/vectorize'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Stream from 'effect/Stream'
import { isResolved } from 'alchemy/Diff'
import { createPhysicalName } from 'alchemy/PhysicalName'
import * as Provider from 'alchemy/Provider'
import { Resource } from 'alchemy/Resource'
import { CloudflareEnvironment } from 'alchemy/Cloudflare'
import type { Providers } from 'alchemy/Cloudflare'

import { VectorizeIndexBinding } from './VectorizeIndexBinding.ts'

export type VectorizeMetric = 'cosine' | 'euclidean' | 'dot-product'

export type VectorizeConfig =
  | { dimensions: number; metric: VectorizeMetric }
  | {
      preset:
        | '@cf/baai/bge-small-en-v1.5'
        | '@cf/baai/bge-base-en-v1.5'
        | '@cf/baai/bge-large-en-v1.5'
        | 'openai/text-embedding-ada-002'
        | 'cohere/embed-multilingual-v2.0'
    }

export type VectorizeIndexProps = {
  /**
   * Index name override. Vectorize index names are 3-64 chars, lowercase
   * alphanumeric + hyphens. If omitted, a unique name is generated from
   * the stack + stage + logical id.
   */
  name?: string
  /**
   * Human-readable description for the index.
   */
  description?: string
  /**
   * Either dimensions + metric, or a preset (which fixes both).
   */
  config: VectorizeConfig
}

export type VectorizeIndex = Resource<
  'F311x.Cloudflare.VectorizeIndex',
  VectorizeIndexProps,
  {
    indexName: string
    accountId: string
    dimensions: number | undefined
    metric: VectorizeMetric | undefined
    createdOn: string | undefined
    modifiedOn: string | undefined
  },
  never,
  Providers
>

/**
 * Cloudflare Vectorize vector search index.
 *
 * @example Create an index
 * ```typescript
 * const knowledge = yield* VectorizeIndex("Knowledge", {
 *   config: { dimensions: 768, metric: "cosine" },
 * })
 * ```
 *
 * @example Bind it into a Worker
 * ```typescript
 * yield* Worker("MyWorker", {
 *   main: "./src/server.ts",
 *   bindings: { KNOWLEDGE: knowledge },
 * })
 * ```
 */
export const VectorizeIndex = Resource<VectorizeIndex>(
  'F311x.Cloudflare.VectorizeIndex',
)({
  bind: VectorizeIndexBinding.bind,
})

const sameConfig = (a: VectorizeConfig, b: VectorizeConfig): boolean => {
  if ('preset' in a && 'preset' in b) return a.preset === b.preset
  if ('dimensions' in a && 'dimensions' in b)
    return a.dimensions === b.dimensions && a.metric === b.metric
  return false
}

export const VectorizeIndexProvider = () =>
  Provider.effect(
    VectorizeIndex,
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment
      const createIndex = yield* vectorize.createIndex
      const getIndex = yield* vectorize.getIndex
      const deleteIndex = yield* vectorize.deleteIndex

      // Cloudflare's `listIndexes` is paginated and accepts no name filter,
      // so adoption-by-name has to scan. Same pattern as KV's
      // `findNamespaceByTitle`.
      const findIndexByName = (name: string) =>
        vectorize.listIndexes.items({ accountId }).pipe(
          Stream.filter((idx) => idx.name === name),
          Stream.runHead,
          Effect.map(Option.getOrUndefined),
        )

      const resolveName = (id: string, name: string | undefined) =>
        Effect.gen(function* () {
          return name ?? (yield* createPhysicalName({ id }))
        })

      const toAttrs = (
        index: {
          name?: string | null
          createdOn?: string | null
          modifiedOn?: string | null
          config?: { dimensions: number; metric: VectorizeMetric } | null
        },
        acct: string,
      ) => ({
        indexName: index.name ?? '',
        accountId: acct,
        dimensions: index.config?.dimensions ?? undefined,
        metric: index.config?.metric ?? undefined,
        createdOn: index.createdOn ?? undefined,
        modifiedOn: index.modifiedOn ?? undefined,
      })

      return {
        stables: ['indexName', 'accountId', 'dimensions', 'metric'],

        // Vectorize indexes are immutable. Any drift => destroy + recreate.
        diff: Effect.fn(function* ({ id, news = {}, olds = {}, output }) {
          if (!isResolved(news)) return undefined
          if ((output?.accountId ?? accountId) !== accountId) {
            return { action: 'replace' } as const
          }
          const newName = yield* resolveName(id, news.name)
          const oldName = output?.indexName ?? (yield* resolveName(id, olds.name))
          if (newName !== oldName) return { action: 'replace' } as const
          if (news.description !== olds.description) {
            return { action: 'replace' } as const
          }
          if (news.config && olds.config && !sameConfig(news.config, olds.config)) {
            return { action: 'replace' } as const
          }
          return undefined
        }),

        reconcile: Effect.fn(function* ({ id, news = {}, output }) {
          const name = yield* resolveName(id, news.name)
          const acct = output?.accountId ?? accountId

          // Observe — re-fetch by cached name, then fall back to a list
          // scan so we recover from out-of-band deletes or partial state
          // persistence failures.
          let observed = output?.indexName
            ? yield* getIndex({ accountId: acct, indexName: output.indexName }).pipe(
                Effect.catchTag('NotFound', () => Effect.succeed(undefined)),
              )
            : undefined

          if (!observed) {
            observed = yield* findIndexByName(name)
          }

          // Ensure — create if missing. A concurrent create on the same
          // name surfaces as `Conflict`; we tolerate it by adopting via
          // list scan.
          if (!observed) {
            observed = yield* createIndex({
              accountId: acct,
              name,
              description: news.description,
              config: news.config,
            }).pipe(
              Effect.catchTag('Conflict', () =>
                Effect.gen(function* () {
                  const match = yield* findIndexByName(name)
                  if (match) return match
                  return yield* Effect.die(
                    `Vectorize index "${name}" already exists but could not be located`,
                  )
                }),
              ),
            )
          }

          return toAttrs(observed, acct)
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* deleteIndex({
            accountId: output.accountId,
            indexName: output.indexName,
          }).pipe(Effect.catchTag('NotFound', () => Effect.void))
        }),

        read: Effect.fn(function* ({ id, olds, output }) {
          if (output?.indexName) {
            return yield* getIndex({
              accountId: output.accountId,
              indexName: output.indexName,
            }).pipe(
              Effect.map((idx) => toAttrs(idx, output.accountId)),
              Effect.catchTag('NotFound', () => Effect.succeed(undefined)),
            )
          }
          const name = yield* resolveName(id, olds?.name)
          const match = yield* findIndexByName(name)
          if (match) return toAttrs(match, accountId)
          return undefined
        }),
      }
    }),
  )
