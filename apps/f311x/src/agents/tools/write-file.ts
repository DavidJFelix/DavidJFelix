import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { writeFileInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { ObjectStore } from '#/effects/services/object-store'
import { getRequestEnv } from '#/server'

export const writeFileDef = toolDefinition({
  name: 'writeFile',
  description: 'Write a UTF-8 text object to an R2 bucket.',
  inputSchema: writeFileInput,
})

export const writeFile = writeFileDef.server(async (input) => {
  const runtime = makeFetchRuntime(getRequestEnv())
  const program = Effect.gen(function* () {
    const store = yield* ObjectStore
    yield* store.put(input.bucket, input.key, input.contents, input.contentType)
    return { ok: true as const, key: input.key }
  })
  return runtime.runPromise(program)
})
