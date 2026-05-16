import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { searchKnowledgeInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
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
    // TODO: replace zero vector with an actual embedding for `input.query`.
    const vector = new Array(1536).fill(0)
    const store = yield* VectorStore
    return yield* store.query(vector, { topK: input.topK })
  })
  return runtime.runPromise(program)
})
