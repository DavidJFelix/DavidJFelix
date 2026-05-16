import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { generateAndDeployHandlerInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { ObjectStore } from '#/effects/services/object-store'
import { WorkflowDispatcher } from '#/effects/services/workflow-dispatcher'
import { getRequestEnv } from '#/server'

export const generateAndDeployHandlerDef = toolDefinition({
  name: 'generateAndDeployHandler',
  description:
    'Persist agent-authored TypeScript and load it as a Dynamic Workflow via the Worker Loader binding.',
  inputSchema: generateAndDeployHandlerInput,
})

export const generateAndDeployHandler = generateAndDeployHandlerDef.server(
  async (input) => {
    const runtime = makeFetchRuntime(getRequestEnv())
    const program = Effect.gen(function* () {
      const store = yield* ObjectStore
      const dispatcher = yield* WorkflowDispatcher
      yield* store.put(
        'workspace',
        `dynamic-plans/${input.planId}.ts`,
        input.source,
        'text/typescript',
      )
      const handle = yield* dispatcher.startDynamicPlan(input.planId, {})
      return { id: handle.id, planId: input.planId }
    })
    return runtime.runPromise(program)
  },
)
