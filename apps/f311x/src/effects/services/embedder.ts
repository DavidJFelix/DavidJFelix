import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

export class EmbedderError extends Data.TaggedError('EmbedderError')<{
  readonly cause: unknown
}> {}

export interface Embedder {
  readonly embed: (text: string) => Effect.Effect<number[], EmbedderError>
}

export const Embedder = Context.GenericTag<Embedder>('@f311x/Embedder')

// Workers AI binding -- defaults to bge-base-en-v1.5 (768 dims) until a
// model swap is decided. Vectorize index dimensions must match.
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'

export const EmbedderLive = (env: Env) =>
  Layer.succeed(
    Embedder,
    Embedder.of({
      embed: (text) =>
        Effect.tryPromise({
          try: async () => {
            const res = (await env.AI.run(EMBEDDING_MODEL, {
              text: [text],
            })) as { data: number[][] }
            const vector = res.data[0]
            if (!vector) throw new Error('Workers AI returned no embedding')
            return vector
          },
          catch: (cause) => new EmbedderError({ cause }),
        }),
    }),
  )
