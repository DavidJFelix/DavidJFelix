import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { readFileInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { ObjectStore } from '#/effects/services/object-store'
import { getRequestEnv } from '#/server'

export const readFileDef = toolDefinition({
  name: 'readFile',
  description: 'Read a UTF-8 text object from an R2 bucket.',
  inputSchema: readFileInput,
})

export const readFile = readFileDef.server(async (input) => {
  const runtime = makeFetchRuntime(getRequestEnv())
  const program = Effect.gen(function* () {
    const store = yield* ObjectStore
    return yield* store.get(input.bucket, input.key)
  })
  return runtime.runPromise(program)
})
