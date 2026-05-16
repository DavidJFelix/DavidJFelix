// Worker entrypoint.
//   1. Try `routeAgentRequest` first -- Agents SDK owns WS + HTTP routing
//      for the Durable Object backing each chat session.
//   2. Fall back to the TanStack Start handler for everything else.
//   3. Per-request Env is stashed so TanStack Start server functions (which
//      don't receive `env`) can read Cloudflare bindings via `getRequestEnv`.

import { routeAgentRequest } from 'agents'
import type { Env } from '#/lib/env'

export { ChatAgent } from '#/agents/chat-agent'
export { ResearchWorkflow } from '#/workflows/research'
export { DynamicPlanWorkflow } from '#/workflows/dynamic-plan'

let currentEnv: Env | null = null
export const getRequestEnv = (): Env => {
  if (!currentEnv) {
    throw new Error('getRequestEnv() called outside of a request scope')
  }
  return currentEnv
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    currentEnv = env
    try {
      const agentResponse = await routeAgentRequest(request, env)
      if (agentResponse) return agentResponse

      // TODO: forward non-agent requests to the TanStack Start handler.
      // The current shape of `createStartHandler` on Workers depends on
      // whether `@cloudflare/vite-plugin` injects the server entry. Confirm
      // and wire once the build pipeline is verified.
      return new Response('f311x worker is running', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    } finally {
      currentEnv = null
    }
  },
} satisfies ExportedHandler<Env>
