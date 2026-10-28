import type {Chat} from './openrouter'

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

// Logs one event for each model call, also for a call that fails.
export function withChatEvents({chat, log, sharedFields}: WithChatEventsParams): Chat {
  return async (request) => {
    // On a deployed Worker the clock moves only at I/O, so this measures the
    // wait for OpenRouter and not the CPU time.
    const startedAt = Date.now()
    const base = {
      event: 'model call',
      ...sharedFields,
      model: request.model,
      messageCount: request.messages.length,
    }
    try {
      const reply = await chat(request)
      log({
        ...base,
        outcome: 'success',
        durationMs: Date.now() - startedAt,
        toolCallCount: reply.toolCalls.length,
        promptTokens: reply.usage.promptTokens,
        completionTokens: reply.usage.completionTokens,
        costUsd: reply.usage.costUsd,
      })
      return reply
    } catch (error) {
      log({...base, outcome: 'error', durationMs: Date.now() - startedAt, error: String(error)})
      throw error
    }
  }
}
