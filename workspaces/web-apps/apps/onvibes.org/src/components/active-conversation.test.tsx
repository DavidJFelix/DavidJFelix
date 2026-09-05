import {EventType, type StreamChunk} from '@tanstack/ai/client'
import {expect, test, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {type Conversation, createConversation} from '@/lib/conversations'
import {ActiveConversation, CHAT_ENDPOINT, type MessagesChange} from './active-conversation'

const NOW = 1_700_000_000_000

// A hanging reply parks here forever, until the client cancels the stream.
const forever = new Promise<never>(() => {})

// The worker's side of the wire, minus the model: an AG-UI run that streams
// `text` back word by word, in the SSE encoding the route's
// toServerSentEventsResponse produces. `hang` stops after the deltas, so the
// run stays in flight.
function reply(text: string, {hang = false} = {}): Response {
  const ids = {threadId: 'thread', runId: 'run'}
  const chunks: Array<StreamChunk> = [
    {type: EventType.RUN_STARTED, ...ids, timestamp: 1},
    {type: EventType.TEXT_MESSAGE_START, messageId: 'reply', role: 'assistant', timestamp: 2},
    ...text.split(/(?<=\s)/u).map((delta): StreamChunk => ({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'reply',
      delta,
      timestamp: 3,
    })),
  ]
  const tail: Array<StreamChunk> = [
    {type: EventType.TEXT_MESSAGE_END, messageId: 'reply', timestamp: 4},
    {type: EventType.RUN_FINISHED, ...ids, finishReason: 'stop', timestamp: 5},
  ]
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(encode(chunk)))
      if (hang) await forever
      for (const chunk of tail) controller.enqueue(encoder.encode(encode(chunk)))
      controller.close()
    },
  })
  return new Response(body, {headers: {'content-type': 'text/event-stream'}})
}

function encode(chunk: StreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`
}

interface WireRequest {
  threadId?: string
  messages: Array<{role: string; content?: unknown}>
}

// Stands in for the worker: answers each POST with the next response in turn
// (the last one repeats) and keeps every request body for the assertions.
function stubChat(...responses: Array<() => Response>) {
  const requests: Array<WireRequest> = []
  // The client always calls with the endpoint string and a JSON string body.
  const fetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
    async (input, init) => {
      expect(input).toBe(CHAT_ENDPOINT)
      expect(init?.method).toBe('POST')
      expect(typeof init?.body).toBe('string')
      requests.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as WireRequest)
      const respond = responses[Math.min(requests.length, responses.length) - 1]
      if (respond === undefined) throw new Error('no response staged')
      return respond()
    },
  )
  vi.stubGlobal('fetch', fetch)
  return {fetch, requests}
}

async function renderActive(conversation = createConversation({id: 'thread', now: NOW})) {
  const onMessagesChange = vi.fn<(change: MessagesChange) => void>()
  const screen = await render(
    <div style={{height: 480}}>
      <ActiveConversation
        conversation={conversation}
        onMessagesChange={onMessagesChange}
        onOpenSidebar={() => {}}
      />
    </div>,
  )
  const main = screen.getByRole('main')
  const send = async (text: string) => {
    await screen.getByRole('textbox', {name: 'Message'}).fill(text)
    await screen.getByRole('button', {name: 'Send message'}).click()
  }
  return {screen, main, send, onMessagesChange}
}

test('a sent message posts the thread and streams the reply into the conversation', async () => {
  // given
  const {fetch, requests} = stubChat(() => reply('Fourteen pins, one card each'))
  const {main, send, onMessagesChange} = await renderActive()

  // when
  await send('Map the canyons')

  // then
  await expect.element(main.getByText('Fourteen pins, one card each')).toBeVisible()
  await expect.element(main.getByText('Map the canyons')).toBeVisible()
  expect(fetch).toHaveBeenCalledOnce()
  expect(requests[0]?.threadId).toBe('thread')
  expect(requests[0]?.messages).toMatchObject([{role: 'user', content: 'Map the canyons'}])
  expect(onMessagesChange).toHaveBeenLastCalledWith({
    id: 'thread',
    messages: [
      {id: expect.any(String), role: 'user', text: 'Map the canyons'},
      {id: 'reply', role: 'assistant', text: 'Fourteen pins, one card each'},
    ],
  })
})

test('a stored thread seeds the conversation without a request', async () => {
  // given
  const {fetch} = stubChat(() => reply('unused'))
  const stored: Conversation = {
    id: 'thread',
    title: 'Trail map',
    updatedAt: NOW,
    messages: [
      {id: 'm1', role: 'user', text: 'Map the canyons'},
      {id: 'm2', role: 'assistant', text: 'Fourteen pins, one card each'},
    ],
  }

  // when
  const {main} = await renderActive(stored)

  // then
  const bubbles = [...main.element().querySelectorAll('[data-role]')]
  expect(bubbles.map((el) => el.textContent)).toEqual([
    'Map the canyons',
    'Fourteen pins, one card each',
  ])
  expect(fetch).not.toHaveBeenCalled()
})

test('a rejected request explains itself, and trying again sends the thread once more', async () => {
  // given
  const {fetch, requests} = stubChat(
    () => new Response('Chat is not configured', {status: 503}),
    () => reply('Back online'),
  )
  const {screen, main, send} = await renderActive()
  await send('Map the canyons')
  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Chat is not set up on this server yet.')

  // when
  await screen.getByRole('button', {name: 'Try again'}).click()

  // then
  await expect.element(main.getByText('Back online')).toBeVisible()
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(requests[1]?.messages.map((m) => m.content)).toEqual(['Map the canyons'])
})

test('stopping keeps what arrived and hands the composer back', async () => {
  // given
  stubChat(() => reply('Fourteen pins, ', {hang: true}))
  const {screen, main, send} = await renderActive()
  await send('Map the canyons')
  await expect.element(main.getByText('Fourteen pins,')).toBeVisible()
  await expect.element(screen.getByRole('button', {name: 'Stop generating'})).toBeVisible()

  // when
  await screen.getByRole('button', {name: 'Stop generating'}).click()

  // then
  await expect.element(screen.getByRole('button', {name: 'Send message'})).toBeVisible()
  await expect.element(main.getByText('Fourteen pins,')).toBeVisible()
})
