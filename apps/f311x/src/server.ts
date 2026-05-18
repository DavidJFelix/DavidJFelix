// Worker entrypoint.
//   1. `routeAgentRequest` first -- Agents SDK owns WS + HTTP routing for
//      the Durable Object backing each chat session.
//   2. TanStack Start handler for everything else, via the default server
//      entry exposed by @tanstack/react-start.
//   3. Per-request Env is stashed in an AsyncLocalStorage so TanStack
//      Start server functions (which don't receive `env`) can read
//      Cloudflare bindings via `getRequestEnv`, safely across concurrent
//      in-flight requests.

import {AsyncLocalStorage} from 'node:async_hooks'
import startEntry from '@tanstack/react-start/server-entry'
import {routeAgentRequest} from 'agents'
import type {Env} from '#/lib/env'

export {Sandbox} from '@cloudflare/sandbox'
export {ChatAgent} from '#/agents/chat-agent'
export {DynamicPlanWorkflow} from '#/workflows/dynamic-plan'
export {ResearchWorkflow} from '#/workflows/research'

const envStorage = new AsyncLocalStorage<Env>()

export const getRequestEnv = (): Env => {
  const env = envStorage.getStore()
  if (!env) {
    throw new Error('getRequestEnv() called outside of a request scope')
  }
  return env
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return envStorage.run(env, async () => {
      const agentResponse = await routeAgentRequest(request, env)
      if (agentResponse) return agentResponse
      return startEntry.fetch(request)
    })
  },
} satisfies ExportedHandler<Env>
