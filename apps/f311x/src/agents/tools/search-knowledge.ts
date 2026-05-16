import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { searchKnowledgeInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { Embedder } from '#/effects/services/embedder'
import { VectorStore } from '#/effects/services/vector-store'
import { getRequestEnv } from '#/server'

export const searchKnowledgeDef = toolDefinition({
  name: 'searchKnowledge',
  description: 'Semantic search over the f311x knowledge index (Vectorize).',
  inputSchema: searchKnowledgeInput,
})

export const searchKnowledge = searchKnowledgeDef.server(async (input) => {
  const runtime = makeFetchRuntime(getRequestEnv())
  const program = Effect.gen(function* () {
    const embedder = yield* Embedder
    const store = yield* VectorStore
    const vector = yield* embedder.embed(input.query)
    return yield* store.query(vector, { topK: input.topK })
  })
  return runtime.runPromise(program)
})
