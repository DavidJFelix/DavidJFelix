import {type FlueConversationPart, FlueProvider, useFlueAgent} from '@flue/react'
import {createFlueClient} from '@flue/sdk'
import React, {useState} from 'react'
import './Chat.css'

// Keep React in value scope for the JSX runtime; harmless if unused.
void React

// The Flue agent HTTP API is served at /api by the Flue Worker that hosts this
// Astro app (see src/app.ts). Same origin, so a relative baseUrl is all we need.
const client = createFlueClient({baseUrl: '/api'})

function Conversation() {
  const [input, setInput] = useState('')
  // A stable per-tab instance id keeps one conversation alive across sends.
  const [instanceId] = useState(() => crypto.randomUUID())
  const [actionError, setActionError] = useState<string>()
  const agent = useFlueAgent({name: 'assistant', id: instanceId})

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()
    if (!message) return
    setInput('')
    setActionError(undefined)
    try {
      await agent.sendMessage(message)
    } catch (error) {
      setInput(message)
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="chat">
      <header>
        <p className="eyebrow">onvibes · Flue</p>
        <h1>Chat</h1>
        <span className={`status ${agent.status}`}>{agent.status}</span>
      </header>

      <div className="messages" aria-live="polite">
        {agent.messages.length === 0 && <p className="empty">Send a message to begin.</p>}
        {agent.messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <strong>{message.role}</strong>
            {message.parts.map((part) => (
              <MessagePart key={partKey(part)} part={part} />
            ))}
          </article>
        ))}
      </div>

      <form onSubmit={submit}>
        <input
          aria-label="Message"
          autoComplete="off"
          onChange={(event) => setInput(event.target.value)}
          placeholder="Say hello"
          value={input}
        />
        <button disabled={!input.trim()} type="submit">
          Send
        </button>
      </form>

      {(actionError || agent.error) && (
        <p className="error">{actionError ?? agent.error?.message}</p>
      )}
    </main>
  )
}

function MessagePart({part}: {part: FlueConversationPart}) {
  if (part.type === 'text') return <p>{part.text}</p>
  if (part.type === 'reasoning')
    return (
      <details>
        <summary>Reasoning</summary>
        {part.text}
      </details>
    )
  if (part.type === 'file') {
    if (!part.url) return <span>Attachment ({part.mediaType})</span>
    return part.mediaType.startsWith('image/') ? (
      <img src={part.url} alt={part.filename ?? 'attachment'} style={{maxWidth: 240}} />
    ) : (
      <a href={part.url}>{part.filename ?? 'Attachment'}</a>
    )
  }
  return (
    <pre>
      {part.toolName}: {part.state}
    </pre>
  )
}

function partKey(part: FlueConversationPart): string {
  if (part.type === 'dynamic-tool') return `tool:${part.toolCallId}`
  if (part.type === 'file') return `file:${part.id ?? part.url ?? part.mediaType}`
  return `${part.type}:${part.text}`
}

export default function Chat() {
  return (
    <FlueProvider client={client}>
      <Conversation />
    </FlueProvider>
  )
}
