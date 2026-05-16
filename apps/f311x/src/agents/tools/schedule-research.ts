import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { scheduleResearchInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { WorkflowDispatcher } from '#/effects/services/workflow-dispatcher'
import { getRequestEnv } from '#/server'

export const scheduleResearchDef = toolDefinition({
  name: 'scheduleResearch',
  description:
    'Kick off the multi-step research Workflow. Returns a handle the client can poll or subscribe to.',
  inputSchema: scheduleResearchInput,
})

export const scheduleResearch = scheduleResearchDef.server(async (input) => {
  const runtime = makeFetchRuntime(getRequestEnv())
  const program = Effect.gen(function* () {
    const dispatcher = yield* WorkflowDispatcher
    const handle = yield* dispatcher.startResearch({
      topic: input.topic,
      depth: input.depth,
    })
    return { id: handle.id }
  })
  return runtime.runPromise(program)
})
