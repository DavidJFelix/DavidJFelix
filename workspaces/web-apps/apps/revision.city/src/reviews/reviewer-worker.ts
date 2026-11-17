import type {ReviewAgent, ReviewAgentEnv} from './review-agent'

// The entry of the `revision-city-reviewer` Worker (wrangler.reviewer.jsonc).
// The Durable Object class must be a named export of the main module.
export {ReviewAgent} from './review-agent'

interface ReviewerWorkerEnv extends ReviewAgentEnv {
  REVIEW_AGENT: DurableObjectNamespace<ReviewAgent>
  // Only the smoke test sets this (bin/smoke-review-agent.ts).
  SMOKE_TEST?: string
}

const SMOKE_PROMPT = 'Reply with the one word: ready'

// The Worker has no public host, so only the smoke test reaches this handler.
// Other Workers call `ReviewAgent` through a binding.
export default {
  async fetch(request, env) {
    if (env.SMOKE_TEST !== 'true' || new URL(request.url).pathname !== '/smoke') {
      return new Response('Not found', {status: 404})
    }
    return Response.json(await env.REVIEW_AGENT.getByName('smoke').ask(SMOKE_PROMPT))
  },
} satisfies ExportedHandler<ReviewerWorkerEnv>
