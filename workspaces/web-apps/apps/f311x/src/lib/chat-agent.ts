import {EventType, type StreamChunk} from '@tanstack/ai/client'

/**
 * The slice of the AG-UI `RunAgentInput` payload the agent endpoint receives
 * from the TanStack AI client. The client POSTs more than this (tools, state,
 * context, forwardedProps), but the echo stub only needs the correlation ids
 * and the conversation so far.
 */
export interface RunAgentInput {
  threadId?: string
  runId?: string
  messages?: ReadonlyArray<IncomingMessage>
}

/**
 * A chat message as it arrives on the wire. The client serializes its UI
 * messages with `uiMessagesToWire`, which yields `ModelMessage`-shaped objects
 * (`content` is a string, or an array of content parts for multimodal turns).
 * We also tolerate the raw `UIMessage` shape (`parts`) so this keeps working
 * even if a caller posts UI messages directly.
 */
export interface IncomingMessage {
  role?: string
  content?: string | ReadonlyArray<ContentSegment> | null
  parts?: ReadonlyArray<ContentSegment>
}

interface ContentSegment {
  type?: string
  text?: string
  content?: string
}

/**
 * Build the assistant's reply. This is an echo stub — no model is wired yet —
 * so it simply repeats the user back, which is enough to prove the request →
 * stream → render loop end to end.
 */
export function echoReply(userText: string): string {
  const trimmed = userText.trim()
  if (trimmed === '') {
    return "I'm f311x — an echo stub for now. Say something and I'll repeat it back."
  }
  return `You said: ${trimmed}`
}

/**
 * Pull the text of the most recent user message out of a wire payload,
 * handling both the `content` (string or parts) and `parts` shapes.
 */
export function lastUserText(messages: RunAgentInput['messages']): string {
  if (!messages) return ''
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== 'user') continue
    const fromParts = segmentsToText(message.parts)
    return fromParts === '' ? segmentsToText(message.content) : fromParts
  }
  return ''
}

/**
 * Stream an echo of the user's last message as AG-UI protocol events. The
 * lifecycle (`RUN_STARTED` → `TEXT_MESSAGE_*` → `RUN_FINISHED`) is what the
 * TanStack AI client's stream processor expects; `toServerSentEventsResponse`
 * turns these chunks into the SSE body the browser consumes. The reply is split
 * into several `TEXT_MESSAGE_CONTENT` deltas so the client renders it
 * progressively, the way a model-backed stream eventually will.
 */
export async function* chatAgentStream(input: RunAgentInput): AsyncGenerator<StreamChunk> {
  const threadId = input.threadId ?? newId('thread')
  const runId = input.runId ?? newId('run')
  const messageId = newId('msg')
  const reply = echoReply(lastUserText(input.messages))

  yield {type: EventType.RUN_STARTED, threadId, runId, timestamp: Date.now()}
  yield {type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant', timestamp: Date.now()}
  for (const delta of toDeltas(reply)) {
    yield {type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta, timestamp: Date.now()}
  }
  yield {type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now()}
  yield {type: EventType.RUN_FINISHED, threadId, runId, finishReason: 'stop', timestamp: Date.now()}
}

function segmentsToText(content: IncomingMessage['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((segment) => segmentText(segment)).join('')
}

function segmentText(segment: ContentSegment): string {
  if (segment.type !== undefined && segment.type !== 'text') return ''
  return segment.text ?? segment.content ?? ''
}

/**
 * Split text after each whitespace run so the pieces rejoin to exactly the
 * original, giving the client several `TEXT_MESSAGE_CONTENT` events to render
 * progressively instead of one big blob.
 */
function toDeltas(text: string): ReadonlyArray<string> {
  const deltas = text.split(/(?<=\s)/u)
  return deltas.length > 0 ? deltas : [text]
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
