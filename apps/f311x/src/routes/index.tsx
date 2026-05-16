import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({ component: ChatPage })

// Day-one transport: HTTP/SSE pointed at the Agents SDK's routed endpoint
// for the default ChatAgent instance. The Agents SDK also supports a WS
// `useAgent` hook -- migration is a transport swap once flows are stable.
const AGENT_ENDPOINT = '/agents/chat-agent/default'

function ChatPage() {
  const chat = useChat({
    connection: fetchServerSentEvents(AGENT_ENDPOINT),
  })

  const [draft, setDraft] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await chat.sendMessage(text)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">f311x</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Chat with an Effect-native agent backed by Cloudflare Workers,
          Vectorize, R2, and Durable Objects.
        </p>
      </header>

      <section className="flex-1 space-y-4 rounded-2xl border border-neutral-200 bg-white/50 p-6 shadow-sm">
        {chat.messages.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet.</p>
        ) : (
          chat.messages.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-neutral-100 p-3"
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
                {m.role}
              </p>
              <div className="whitespace-pre-wrap text-sm">
                {renderMessageBody(m)}
              </div>
            </article>
          ))
        )}
      </section>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something..."
          className="flex-1 rounded-xl border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={chat.status === 'streaming' || !draft.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  )
}

const renderMessageBody = (m: { parts?: Array<{ type: string; text?: string }> }) =>
  (m.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
