import {expect, test, vi} from 'vitest'
import {probeReviewAgent, type ReviewAgent} from './review-agent-probe'
import type {LogWideEvent} from './wide-event'

const usage = {
  inputTokens: 12,
  outputTokens: 3,
  reasoningTokens: 1,
  cachedInputTokens: 4,
  costUsd: 0.0002,
}
const model = 'vendor/agent-model'
const sharedFields = {runId: 'review-run', pullNumber: 7}

const answering = (answer: unknown) => ({ask: vi.fn<ReviewAgent['ask']>(async () => answer)})

test('probeReviewAgent sends one prompt and logs the answer with the usage and the shared fields', async () => {
  const log = vi.fn<LogWideEvent>()
  const agent = answering({status: 'done', text: 'ready', model, ...usage})

  await probeReviewAgent({agent, log, sharedFields})

  expect(agent.ask).toHaveBeenCalledExactlyOnceWith('Reply with the one word: ready')
  expect(log).toHaveBeenCalledExactlyOnceWith({
    event: 'review agent probe',
    ...sharedFields,
    outcome: 'success',
    durationMs: expect.any(Number),
    agentModel: model,
    answer: 'ready',
    reason: undefined,
    ...usage,
  })
})

test('probeReviewAgent logs only the start of a long answer', async () => {
  const log = vi.fn<LogWideEvent>()

  await probeReviewAgent({
    agent: answering({status: 'done', text: 'r'.repeat(500), model, ...usage}),
    log,
    sharedFields,
  })

  expect(log).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({answer: 'r'.repeat(200)}))
})

test('probeReviewAgent logs the reason when the agent has no answer', async () => {
  const log = vi.fn<LogWideEvent>()

  await probeReviewAgent({
    agent: answering({status: 'unanswered', reason: 'The provider refused', model, ...usage}),
    log,
    sharedFields,
  })

  expect(log).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      outcome: 'unanswered',
      answer: undefined,
      reason: 'The provider refused',
    }),
  )
})

test.each<{name: string; agent: ReviewAgent; error: string}>([
  {
    name: 'the call fails',
    agent: {
      ask: async () => {
        throw new Error('The harness Worker is down')
      },
    },
    error: 'Error: The harness Worker is down',
  },
  {
    name: 'the answer has no usage',
    agent: answering({status: 'done', text: 'ready'}),
    error: 'inputTokens',
  },
  {
    name: 'the agent does not answer in time',
    agent: {ask: () => new Promise(() => {})},
    error: 'Error: The review agent did not answer in 5 ms',
  },
])('probeReviewAgent logs an error event and does not throw when $name', async ({agent, error}) => {
  const log = vi.fn<LogWideEvent>()

  await expect(probeReviewAgent({agent, log, sharedFields, timeoutMs: 5})).resolves.toBeUndefined()

  expect(log).toHaveBeenCalledExactlyOnceWith({
    event: 'review agent probe',
    ...sharedFields,
    outcome: 'error',
    durationMs: expect.any(Number),
    error: expect.stringContaining(error),
  })
})
