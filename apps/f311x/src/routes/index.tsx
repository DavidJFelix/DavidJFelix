import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: ChatPage })

function ChatPage() {
  // TODO: wire `useChat` from `@tanstack/ai-react` once the transport
  // adapter for `useAgent` (WebSocket -> Agents SDK DO) is in place.
  // Until then this is a static placeholder so the build stays green.
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">f311x</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Chat with an Effect-native agent backed by Cloudflare Workers,
          Vectorize, R2, and Durable Objects.
        </p>
      </header>

      <section className="flex-1 rounded-2xl border border-neutral-200 bg-white/50 p-6 shadow-sm">
        <p className="text-sm text-neutral-600">
          Chat transport not yet wired. See <code>src/agents/chat-agent.ts</code>{' '}
          and <code>src/routes/index.tsx</code> for the next steps.
        </p>
      </section>
    </main>
  )
}
