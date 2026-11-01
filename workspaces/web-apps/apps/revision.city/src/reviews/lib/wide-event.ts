import {type Chat, MAX_ANSWER_TOKENS, REASONING_EFFORT} from './openrouter'

export type WideEventValue = string | number | boolean | undefined

export type WideEventFields = Readonly<Record<string, WideEventValue>>

export type WideEvent = WideEventFields & Readonly<{event: string}>

export type LogWideEvent = (event: WideEvent) => void

// Workers Logs keeps the fields of a logged object as separate fields, and the
// OpenTelemetry export forwards them. One event for each unit of work keeps
// the fields of that unit together.
export const logWideEvent: LogWideEvent = (event) => {
  console.log(event)
}

export interface WithChatEventsParams {
  chat: Chat
  log: LogWideEvent
  sharedFields: WideEventFields
}

// Enough of the reasoning to tell a model that repeats itself from a model
// that still reasons about the change.
const REASONING_TAIL_CHARS = 2000

// Logs one event for each model call, also for a call that fails.
export function withChatEvents({chat, log, sharedFields}: WithChatEventsParams): Chat {
  return async (request) => {
    // On a deployed Worker the clock moves only at I/O, so this measures the
    // wait for OpenRouter and not the CPU time.
    const startedAt = Date.now()
    const base = {
      event: 'model call',
      ...sharedFields,
      ...request.eventFields,
      model: request.model,
      messageCount: request.messages.length,
      promptChars: request.messages.reduce((total, message) => total + message.content.length, 0),
      toolChoice: request.tools === undefined ? 'no tools' : (request.toolChoice ?? 'auto'),
      maxTokens: MAX_ANSWER_TOKENS,
      reasoningEffort: REASONING_EFFORT,
    }
    try {
      const reply = await chat(request)
      const reasoning = reply.reasoning?.text ?? ''
      log({
        ...base,
        outcome: 'success',
        durationMs: Date.now() - startedAt,
        provider: reply.provider,
        finishReason: reply.finishReason,
        toolCallCount: reply.toolCalls.length,
        promptTokens: reply.usage.promptTokens,
        completionTokens: reply.usage.completionTokens,
        reasoningTokens: reply.reasoningTokens,
        reasoningChars: reasoning.length,
        answerChars: reply.content.length,
        costUsd: reply.usage.costUsd,
        // Only a cut reply keeps a part of its reasoning, so the logs stay small.
        reasoningTail:
          reply.finishReason === 'length' ? reasoning.slice(-REASONING_TAIL_CHARS) : undefined,
      })
      return reply
    } catch (error) {
      log({...base, outcome: 'error', durationMs: Date.now() - startedAt, error: String(error)})
      throw error
    }
  }
}
