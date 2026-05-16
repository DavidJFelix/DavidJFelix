import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

export class ObjectStoreError extends Data.TaggedError('ObjectStoreError')<{
  readonly bucket: 'uploads' | 'workspace'
  readonly key: string
  readonly cause: unknown
}> {}

export class ObjectNotFoundError extends Data.TaggedError('ObjectNotFoundError')<{
  readonly bucket: 'uploads' | 'workspace'
  readonly key: string
}> {}

export interface ObjectStore {
  readonly get: (
    bucket: 'uploads' | 'workspace',
    key: string,
  ) => Effect.Effect<string, ObjectStoreError | ObjectNotFoundError>
  readonly put: (
    bucket: 'uploads' | 'workspace',
    key: string,
    contents: string,
    contentType?: string,
  ) => Effect.Effect<void, ObjectStoreError>
}

export const ObjectStore = Context.GenericTag<ObjectStore>('@f311x/ObjectStore')

const bucketOf = (env: Env, b: 'uploads' | 'workspace') =>
  b === 'uploads' ? env.UPLOADS : env.WORKSPACE

export const ObjectStoreLive = (env: Env) =>
  Layer.succeed(
    ObjectStore,
    ObjectStore.of({
      get: (bucket, key) =>
        Effect.tryPromise({
          try: async () => {
            const obj = await bucketOf(env, bucket).get(key)
            if (!obj) return null
            return obj.text()
          },
          catch: (cause) => new ObjectStoreError({ bucket, key, cause }),
        }).pipe(
          Effect.flatMap((text) =>
            text === null
              ? Effect.fail(new ObjectNotFoundError({ bucket, key }))
              : Effect.succeed(text),
          ),
        ),
      put: (bucket, key, contents, contentType) =>
        Effect.tryPromise({
          try: () =>
            bucketOf(env, bucket).put(key, contents, {
              httpMetadata: contentType
                ? { contentType }
                : undefined,
            }),
          catch: (cause) => new ObjectStoreError({ bucket, key, cause }),
        }).pipe(Effect.asVoid),
    }),
  )
