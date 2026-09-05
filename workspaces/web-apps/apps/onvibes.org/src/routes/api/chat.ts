import {chat, toServerSentEventsResponse} from '@tanstack/ai'
import {createOpenRouterText} from '@tanstack/ai-openrouter'
import {createFileRoute} from '@tanstack/react-router'
import {z} from 'zod'
import {CHAT_MODEL, chatEnvSchema, chatRequestSchema, SYSTEM_PROMPT} from '@/lib/chat'

// The chat endpoint. The client (src/components/active-conversation.tsx) POSTs
// the conversation so far as an AG-UI run and reads the reply back as
// Server-Sent Events. Runs in the worker, so the OpenRouter key never reaches
// the browser. 400 for a body outside the contract in src/lib/chat.ts; 503
// until the OPENROUTER_API_KEY secret is set (`wrangler secret put
// OPENROUTER_API_KEY`; `.dev.vars` locally).

// OpenRouter's app attribution headers (shown on its activity page).
const APP_URL = 'https://onvibes.org'
const APP_TITLE = 'onvibes.org'

async function answer(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => undefined)
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) return new Response(z.prettifyError(parsed.error), {status: 400})

  // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
  // environment, and this keeps it out of the client bundle entirely.
  const {env} = await import('cloudflare:workers')
  const config = chatEnvSchema.safeParse(env)
  if (!config.success) return new Response('Chat is not configured', {status: 503})

  const {threadId, runId, messages} = parsed.data
  // Shared between the model call and the response, so a client that
  // disconnects mid-reply aborts the upstream request instead of running it
  // to completion for nobody.
  const abortController = new AbortController()
  const stream = chat({
    adapter: createOpenRouterText(CHAT_MODEL, config.data.OPENROUTER_API_KEY, {
      httpReferer: APP_URL,
      appTitle: APP_TITLE,
    }),
    messages,
    systemPrompts: [SYSTEM_PROMPT],
    threadId,
    runId,
    abortController,
  })
  return toServerSentEventsResponse(stream, {abortController})
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: ({request}) => answer(request),
    },
  },
})
