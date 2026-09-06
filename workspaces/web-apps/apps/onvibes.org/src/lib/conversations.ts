// The conversation model behind the sidebar + conversation shell. TanStack AI
// drives the active conversation; this plain data is what the sidebar lists
// and what a conversation is restored from when selected again. Nothing
// persists: conversations live in memory for the page's lifetime.

import type {UIMessage} from '@tanstack/ai-react'

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  text: string
}

export interface Conversation {
  id: string
  title: string
  // Epoch milliseconds of the last change, behind the sidebar's age label.
  updatedAt: number
  messages: ReadonlyArray<Message>
}

export const NEW_CONVERSATION_TITLE = 'New conversation'
const TITLE_MAX_LENGTH = 40
const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

export interface FormatRelativeTimeParams {
  updatedAt: number
  now: number
}

// Compact "how long ago" label for the sidebar: 'now', '12m', '3h', '2d'.
export function formatRelativeTime({updatedAt, now}: FormatRelativeTimeParams): string {
  const minutesAgo = (now - updatedAt) / MS_PER_MINUTE
  if (minutesAgo < 1) return 'now'
  if (minutesAgo < MINUTES_PER_HOUR) return `${Math.floor(minutesAgo)}m`
  if (minutesAgo < MINUTES_PER_DAY) return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)}h`
  return `${Math.floor(minutesAgo / MINUTES_PER_DAY)}d`
}

// The last message, collapsed to one line for the sidebar row.
export function previewOf(conversation: Conversation): string {
  const last = conversation.messages.at(-1)
  return last === undefined ? 'No messages yet' : last.text.replaceAll(/\s+/gu, ' ').trim()
}

// A conversation is titled after its first message, trimmed to fit the row.
export function titleFrom(text: string): string {
  const oneLine = text.replaceAll(/\s+/gu, ' ').trim()
  if (oneLine.length <= TITLE_MAX_LENGTH) return oneLine
  const cut = oneLine.slice(0, TITLE_MAX_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}

export interface CreateConversationParams {
  id: string
  now: number
}

export function createConversation({id, now}: CreateConversationParams): Conversation {
  return {id, title: NEW_CONVERSATION_TITLE, updatedAt: now, messages: []}
}

function sameMessage(a: Message, b: Message): boolean {
  return a.id === b.id && a.role === b.role && a.text === b.text
}

function sameMessages(a: ReadonlyArray<Message>, b: ReadonlyArray<Message>): boolean {
  return a.length === b.length && a.every((message, index) => sameMessage(message, b[index]))
}

export interface WithMessagesParams {
  conversation: Conversation
  messages: ReadonlyArray<Message>
  now: number
}

// Adopts the live thread from the chat client. Returns the very same
// conversation when nothing changed, so a caller can skip the state update;
// otherwise refreshes the row metadata, and an untitled conversation takes its
// title from the first message.
export function withMessages({conversation, messages, now}: WithMessagesParams): Conversation {
  if (sameMessages(conversation.messages, messages)) return conversation
  const first = messages[0]
  const untitled = conversation.messages.length === 0 && first !== undefined
  return {
    ...conversation,
    title: untitled ? titleFrom(first.text) : conversation.title,
    updatedAt: now,
    messages,
  }
}

export interface ReplaceConversationParams {
  conversations: ReadonlyArray<Conversation>
  conversation: Conversation
}

// Swaps the conversation with the matching id, keeping list order stable.
export function replaceConversation({
  conversations,
  conversation,
}: ReplaceConversationParams): ReadonlyArray<Conversation> {
  return conversations.map((c) => (c.id === conversation.id ? conversation : c))
}

// Bridges to TanStack AI's parts-based UIMessage. The shell renders plain
// text, so a message is the concatenation of its text parts (reasoning and
// tool parts, should a model emit them, stay out of the bubble) and goes back
// out as a single text part. System messages never reach the thread.
export function messagesFromUI(messages: ReadonlyArray<UIMessage>): ReadonlyArray<Message> {
  return messages.flatMap((message) =>
    message.role === 'system'
      ? []
      : [
          {
            id: message.id,
            role: message.role,
            text: message.parts
              .filter((part) => part.type === 'text')
              .map((part) => part.content)
              .join(''),
          },
        ],
  )
}

export function messageToUI({id, role, text}: Message): UIMessage {
  return {id, role, parts: [{type: 'text', content: text}]}
}
