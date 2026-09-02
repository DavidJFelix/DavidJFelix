// The conversation model behind the sidebar + conversation shell. Nothing here
// talks to a backend: the seed below is fixture data so the shell has something
// to render, and the functions are pure so the eventual TanStack AI wiring can
// replace the seed without touching the components.

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  text: string
}

export interface Conversation {
  id: string
  title: string
  // Minutes since the last message. Fixture data carries an offset rather than
  // a timestamp so the rendered label is deterministic (no clock, no drift in
  // the visual baseline); a backend would derive this from a real timestamp.
  updatedMinutesAgo: number
  messages: ReadonlyArray<Message>
}

export const NEW_CONVERSATION_TITLE = 'New conversation'
const TITLE_MAX_LENGTH = 40
const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

export interface FormatRelativeTimeParams {
  minutesAgo: number
}

// Compact "how long ago" label for the sidebar: 'now', '12m', '3h', '2d'.
export function formatRelativeTime({minutesAgo}: FormatRelativeTimeParams): string {
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
}

export function createConversation({id}: CreateConversationParams): Conversation {
  return {id, title: NEW_CONVERSATION_TITLE, updatedMinutesAgo: 0, messages: []}
}

export interface AppendMessageParams {
  conversation: Conversation
  message: Message
}

// Returns a new conversation with the message appended and the row metadata
// refreshed; an untitled conversation takes its title from this message.
export function appendMessage({conversation, message}: AppendMessageParams): Conversation {
  const isFirst = conversation.messages.length === 0
  return {
    ...conversation,
    title: isFirst ? titleFrom(message.text) : conversation.title,
    updatedMinutesAgo: 0,
    messages: [...conversation.messages, message],
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

export const SEED_CONVERSATIONS: ReadonlyArray<Conversation> = [
  {
    id: 'trail-map',
    title: 'Trail map for Starved Rock',
    updatedMinutesAgo: 12,
    messages: [
      {
        id: 'trail-map-1',
        role: 'user',
        text: 'I want a single-page trail map for Starved Rock with the canyons marked and a rough difficulty for each loop.',
      },
      {
        id: 'trail-map-2',
        role: 'assistant',
        text: 'Here is the plan: a static map image with the fourteen canyons pinned, each pin opening a card with distance, elevation gain, and a one-line difficulty note. No backend, one HTML file, works offline once loaded.',
      },
      {
        id: 'trail-map-3',
        role: 'user',
        text: 'Can the pins cluster when zoomed out? The east side gets crowded.',
      },
      {
        id: 'trail-map-4',
        role: 'assistant',
        text: 'Yes. Pins within 24px of each other collapse into a count badge, and tapping the badge zooms one level in and fans them out. I kept the clustering to a short pure function so it is easy to tune.',
      },
    ],
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro timer with ambient sound',
    updatedMinutesAgo: 3 * MINUTES_PER_HOUR,
    messages: [
      {
        id: 'pomodoro-1',
        role: 'user',
        text: 'Build a pomodoro timer that plays rain sounds during focus blocks and goes quiet on breaks.',
      },
      {
        id: 'pomodoro-2',
        role: 'assistant',
        text: 'Done: 25/5 by default, both adjustable, and the rain loops through the Web Audio API with a two-second fade so the transition into a break is not abrupt. The tab title shows the remaining time.',
      },
    ],
  },
  {
    id: 'recipe-scaler',
    title: 'Recipe scaler',
    updatedMinutesAgo: MINUTES_PER_DAY + 4 * MINUTES_PER_HOUR,
    messages: [
      {
        id: 'recipe-scaler-1',
        role: 'user',
        text: 'Paste a recipe, pick how many servings, get the ingredients scaled. Fractions should stay fractions.',
      },
      {
        id: 'recipe-scaler-2',
        role: 'assistant',
        text: 'The parser picks out quantity, unit, and ingredient per line and scales the quantity as a rational, so 3/4 cup times two prints as 1 1/2 cups rather than 1.5. Lines it cannot parse pass through unchanged.',
      },
      {
        id: 'recipe-scaler-3',
        role: 'user',
        text: 'Nice. Add a toggle for metric.',
      },
    ],
  },
  {
    id: 'habit-widget',
    title: 'Habit tracker widget',
    updatedMinutesAgo: 3 * MINUTES_PER_DAY,
    messages: [
      {
        id: 'habit-widget-1',
        role: 'user',
        text: 'A tiny embeddable widget: one habit, a row of dots for the last 30 days, tap today to mark it.',
      },
      {
        id: 'habit-widget-2',
        role: 'assistant',
        text: 'It is a single web component, state in localStorage keyed by the habit name, and the dot row is one flex container so it fits any width you drop it into.',
      },
    ],
  },
  {
    id: 'split-bill',
    title: 'Split the bill by item',
    updatedMinutesAgo: 6 * MINUTES_PER_DAY,
    messages: [
      {
        id: 'split-bill-1',
        role: 'user',
        text: 'Split a restaurant bill by who ordered what, with tax and tip spread proportionally.',
      },
      {
        id: 'split-bill-2',
        role: 'assistant',
        text: 'Each person gets a column, each line item a row, and you tap cells to assign shares. Tax and tip are distributed by each person’s pre-tax share and rounded so the totals always sum to the bill.',
      },
    ],
  },
]
