import {toServerSentEventsResponse} from '@tanstack/ai'
import {createFileRoute} from '@tanstack/react-router'
import {chatAgentStream, type RunAgentInput} from '@/lib/chat-agent'

// The chat UI (`src/routes/index.tsx`) POSTs an AG-UI `RunAgentInput` here and
// reads the reply as Server-Sent Events. For now this is an echo stub: it
// streams the user's message back. Swapping in a real model later means
// replacing `chatAgentStream` with a model-backed stream — the wire contract
// and this route stay the same.
export const Route = createFileRoute('/agents/chat-agent/default')({
  server: {
    handlers: {
      POST: async ({request}) => {
        const input = (await request.json().catch(() => ({}))) as RunAgentInput
        return toServerSentEventsResponse(chatAgentStream(input))
      },
    },
  },
})
