### feat(onvibes.org): text conversations through OpenRouter on TanStack AI

The conversation shell now talks to a model. A new `/api/chat` server route runs in the worker: it
parses the AG-UI run the TanStack AI client posts with a Zod schema (`src/lib/chat.ts` -- user and
assistant turns only, text only, bounded in count and length, every other wire key dropped), reads
the `OPENROUTER_API_KEY` secret from the worker env through a second Zod schema, and answers with
`chat()` from `@tanstack/ai` behind the `@tanstack/ai-openrouter` adapter, streamed back as
Server-Sent Events by `toServerSentEventsResponse`. The model is `openai/gpt-5.6-luna`. A body
outside the contract gets a 400 with Zod's pretty error; until the secret is set
(`wrangler secret put OPENROUTER_API_KEY`, `.dev.vars` locally -- see the new `.dev.vars.example`)
the route answers 503. One abort controller is shared between the model call and the response, so a
client that disconnects mid-reply cancels the upstream request.

On the client, `ActiveConversation` wraps `useChat` from `@tanstack/ai-react` over a hoisted
`fetchServerSentEvents('/api/chat')` connection. It mounts keyed by conversation id, seeds the hook
from the stored thread, and mirrors every change (the send, each streamed delta, a stop) back into
the conversation list through the pure `withMessages`, so the sidebar's title, preview, and age
follow the stream and a thread survives switching away and back. The shell learned the states a real
reply has: a placeholder holds the assistant's place until the first token, the send button becomes
"Stop generating" while a reply streams (Enter waits), the thread follows the growing last bubble,
and a failed reply shows why ("Chat is not set up on this server yet." for the 503, a generic line
otherwise) with a "Try again" that calls `reload()`.

No database yet: conversations are in-memory for the page's lifetime, so the fixture conversations
are gone and the app opens on a fresh one (its id comes from `useId`, stable across SSR and
hydration). `updatedMinutesAgo` became a real `updatedAt` timestamp, read against a clock the
sidebar keeps in state and ticks every 30 seconds.

Tests: `chat.ts`, `chat-errors.ts`, and the reworked conversation model keep 100% unit coverage.
`active-conversation.test.tsx` renders the wired component in Chromium against a stubbed `fetch`
that streams a hand-encoded SSE reply -- it proves the wire (thread id, message shape), the streamed
render, the sync back up, the 503 copy plus retry, and stop keeping the partial reply. The e2e suite
mocks `/api/chat` with Playwright's `page.route` for the same canned stream, so it stays
deterministic against a preview deploy with no key involved; one test posts an invalid body to the
real route and expects 400. The three visual baselines were re-recorded for the empty first
conversation. The smoke gate now also POSTs the chat route: 400 for an invalid body, and 503 (or 200
with a local key) for a valid one.
