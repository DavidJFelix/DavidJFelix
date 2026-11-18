import {z} from 'zod'
import type {LogWideEvent, WideEventFields} from './wide-event'

// The method of the `ReviewAgent` Durable Object in the harness Worker
// (workspaces/harnesses/opencode) that a review calls.
export interface ReviewAgent {
  ask: (prompt: string) => Promise<unknown>
}

// The harness Worker has its own deploy, so its answer can change before this
// code does.
const reviewAgentAnswerSchema = z.object({
  status: z.enum(['done', 'unanswered']),
  text: z.string().optional(),
  reason: z.string().optional(),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  cachedInputTokens: z.number(),
  costUsd: z.number(),
})

const PROBE_PROMPT = 'Reply with the one word: ready'

// The first prompt after a deploy loads OpenCode, and then the model answers.
const PROBE_TIMEOUT_MS = 120_000

const LOGGED_ANSWER_CHARS = 200

export interface ProbeReviewAgentParams {
  agent: ReviewAgent
  log: LogWideEvent
  sharedFields: WideEventFields
  timeoutMs?: number
}

// Does not throw: a probe that fails only logs an event.
export async function probeReviewAgent({
  agent,
  log,
  sharedFields,
  timeoutMs = PROBE_TIMEOUT_MS,
}: ProbeReviewAgentParams): Promise<void> {
  const startedAt = Date.now()
  const base = {event: 'review agent probe', ...sharedFields}
  try {
    const answer = reviewAgentAnswerSchema.parse(
      await rejectAfter({promise: agent.ask(PROBE_PROMPT), timeoutMs}),
    )
    log({
      ...base,
      outcome: answer.status === 'done' ? 'success' : 'unanswered',
      durationMs: Date.now() - startedAt,
      agentModel: answer.model,
      answer: answer.text?.slice(0, LOGGED_ANSWER_CHARS),
      reason: answer.reason,
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
      reasoningTokens: answer.reasoningTokens,
      cachedInputTokens: answer.cachedInputTokens,
      costUsd: answer.costUsd,
    })
  } catch (error) {
    log({...base, outcome: 'error', durationMs: Date.now() - startedAt, error: String(error)})
  }
}

interface RejectAfterParams<Value> {
  promise: Promise<Value>
  timeoutMs: number
}

async function rejectAfter<Value>({promise, timeoutMs}: RejectAfterParams<Value>): Promise<Value> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`The review agent did not answer in ${timeoutMs} ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
