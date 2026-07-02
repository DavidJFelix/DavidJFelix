import {fauxAssistantMessage, fauxText, registerFauxProvider} from '@earendil-works/pi-ai/compat'
import {type AgentRouteHandler, defineAgent, registerProvider} from '@flue/runtime'

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
// registerFauxProvider only supplies the API *transport*; Flue resolves
// "onvibes/assistant" against its provider registry (then pi-ai's builtin
// catalog, which never contains faux models). Register the provider ID so
// resolveModel can find it and route to the faux transport above.
registerProvider('onvibes', {api: 'onvibes', baseUrl: ''})
// The faux provider consumes ONE queued response per model call (shift off a
// queue); a plain one-element queue would echo the first message and error
// ("No more faux responses queued") on every message after it. Re-queue the
// responder on each call so the echo answers indefinitely.
const echo: Parameters<typeof faux.setResponses>[0][number] = (context) => {
  faux.appendResponses([echo])
  const input = context.messages.at(-1)
  const text =
    input?.role === 'user'
      ? typeof input.content === 'string'
        ? input.content
        : input.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
      : ''
  return fauxAssistantMessage(fauxText(`You said: ${text}`))
}
faux.setResponses([echo])

export default defineAgent(() => ({
  model: 'onvibes/assistant',
  instructions: 'Reply briefly and helpfully.',
}))
