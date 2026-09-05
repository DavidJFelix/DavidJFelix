import type {Page} from '@playwright/test'

// Shared by the Playwright specs (not a spec itself: importing one spec from
// another would register its tests twice). Answers every chat request with a
// canned AG-UI stream, so the suite is deterministic and needs no OpenRouter
// key whether it runs against a local production boot or a preview deploy.

function sse(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

// Streams `text` the way the worker streams a reply: one assistant message in
// a few deltas, correlated to the run the client opened.
export async function mockReply(page: Page, text: string) {
  await page.route('**/api/chat', async (route) => {
    const {threadId, runId} = route.request().postDataJSON() as {
      threadId?: string
      runId?: string
    }
    const ids = {threadId: threadId ?? 'thread', runId: runId ?? 'run'}
    await route.fulfill({
      status: 200,
      headers: {'content-type': 'text/event-stream'},
      body: sse([
        {type: 'RUN_STARTED', ...ids, timestamp: 1},
        {type: 'TEXT_MESSAGE_START', messageId: 'reply', role: 'assistant', timestamp: 2},
        ...text.split(/(?<=\s)/u).map((delta) => ({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: 'reply',
          delta,
          timestamp: 3,
        })),
        {type: 'TEXT_MESSAGE_END', messageId: 'reply', timestamp: 4},
        {type: 'RUN_FINISHED', ...ids, finishReason: 'stop', timestamp: 5},
      ]),
    })
  })
}
