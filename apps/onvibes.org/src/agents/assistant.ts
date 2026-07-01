import {fauxAssistantMessage, fauxText, registerFauxProvider} from '@earendil-works/pi-ai/compat'
import {type AgentRouteHandler, defineAgent} from '@flue/runtime'

// Opt this agent into HTTP transport so the mounted flue() sub-app serves it at
// `/api/agents/assistant/:id`. Without an exported `route` the agent stays
// private (only reachable via in-process dispatch), and the /chat React island
// -- which talks to it over HTTP -- would get a 404.
export const route: AgentRouteHandler = async (_c, next) => next()

// Register the faux model provider at module load, before any harness
// initializes and resolves the model. (Registering inside the defineAgent
// initializer is too late on the Cloudflare runtime -- resolveModel runs in the
// same init pass and won't see it.) This is a zero-dependency echo provider: no
// API key, deterministic output. Swap `model` below for a real provider
// (e.g. Cloudflare's `AI` binding) once credentials are wired.
const faux = registerFauxProvider({
  api: 'onvibes',
  provider: 'onvibes',
  models: [{id: 'assistant'}],
})
faux.setResponses([
  (context) => {
    const input = context.messages.at(-1)
    const text =
      input?.role === 'user'
        ? typeof input.content === 'string'
          ? input.content
          : input.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
        : ''
    return fauxAssistantMessage(fauxText(`You said: ${text}`))
  },
])

export default defineAgent(() => ({
  model: 'onvibes/assistant',
  instructions: 'Reply briefly and helpfully.',
}))
