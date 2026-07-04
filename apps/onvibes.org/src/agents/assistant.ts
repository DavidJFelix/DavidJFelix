import {type AgentRouteHandler, defineAgent} from '@flue/runtime'

// Opt this agent into HTTP transport so the mounted flue() sub-app serves it at
// `/api/agents/assistant/:id`. Without an exported `route` the agent stays
// private (only reachable via in-process dispatch), and the /chat React island
// -- which talks to it over HTTP -- would get a 404.
export const route: AgentRouteHandler = async (_c, next) => next()

// The "onvibes/assistant" model is the keyless faux echo provider registered in
// src/app.ts (Flue convention: provider setup lives in the app entrypoint, not
// in agent modules). Swap it there for a real provider once credentials are
// wired.
export default defineAgent(() => ({
  model: 'onvibes/assistant',
  instructions: 'Reply briefly and helpfully.',
}))
