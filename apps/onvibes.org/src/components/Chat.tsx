import {type FlueConversationPart, FlueProvider, useFlueAgent} from '@flue/react'
import {createFlueClient} from '@flue/sdk'
import {type FormEvent, useState} from 'react'
import './chat.css'

// The Flue agent HTTP API is served at /api by the Flue Worker that hosts this
// Astro app (see src/app.ts). Same origin, so a relative baseUrl is all we need.
const client = createFlueClient({baseUrl: '/api'})

function Conversation() {
  const [input, setInput] = useState('')
  // A stable per-tab instance id keeps one conversation alive across sends.
  const [instanceId] = useState(() => crypto.randomUUID())
  const [actionError, setActionError] = useState<string>()
  const agent = useFlueAgent({name: 'assistant', id: instanceId})
  // One in-flight send per agent session -- Flue rejects concurrent
  // submissions on the same instance, so gate the form while one is active.
  const busy = agent.status === 'submitted' || agent.status === 'streaming'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()
    if (!message || busy) return
    setInput('')
    setActionError(undefined)
    try {
      await agent.sendMessage(message)
    } catch (error) {
      // Only restore the failed message if the field is still empty -- don't
      // clobber anything the user typed while the send was in flight.
      setInput((current) => current || message)
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
            {/* Parts are append-only within a message and text/reasoning parts
                carry no id, so the position is the stable identity. Keying by
                content would remount the node on every streaming delta. */}
            {message.parts.map((part, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- append-only array, no stable id on parts
              <MessagePart key={index} part={part} />
            ))}
          </article>
        ))}
      </div>

      <form onSubmit={submit}>
        <input
          aria-label="Message"
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Say hello"
          value={input}
        />
        <button disabled={busy || !input.trim()} type="submit">
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
    // Only render URLs we can vouch for. A real model (once the faux echo is
    // swapped out) could emit a `javascript:` URL that would fire on click.
    if (!part.url || !isSafeUrl(part.url)) return <span>Attachment ({part.mediaType})</span>
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

// Allow only http(s) attachment URLs; everything else (javascript:, data:, ...)
// falls back to plain text. Relative URLs resolve against the page origin.
function isSafeUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url, window.location.href).protocol)
  } catch {
    return false
  }
}

export default function Chat() {
  return (
    <FlueProvider client={client}>
      <Conversation />
    </FlueProvider>
  )
}
