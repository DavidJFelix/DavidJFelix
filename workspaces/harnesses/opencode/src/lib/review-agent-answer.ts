// The usage fields of a message in the harness transcript. Only an assistant
// message has the tokens and the cost.
export interface TranscriptMessage {
  type: string
  tokens?: {
    input: number
    output: number
    reasoning: number
    cache: {read: number; write: number}
  }
  cost?: number
}

export interface AnswerUsage {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedInputTokens: number
  costUsd: number
}

export interface ReviewAgentAnswer extends AnswerUsage {
  status: 'done' | 'unanswered'
  text?: string
  reason?: string
  model: string
}

const NO_USAGE: AnswerUsage = {
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cachedInputTokens: 0,
  costUsd: 0,
}

// One answer can take more than one model call, so this adds the usage of all
// the messages.
export const summarizeUsage = (messages: readonly TranscriptMessage[]): AnswerUsage =>
  messages.reduce<AnswerUsage>(
    (total, {tokens, cost}) => ({
      inputTokens: total.inputTokens + (tokens?.input ?? 0),
      outputTokens: total.outputTokens + (tokens?.output ?? 0),
      reasoningTokens: total.reasoningTokens + (tokens?.reasoning ?? 0),
      cachedInputTokens: total.cachedInputTokens + (tokens?.cache.read ?? 0),
      costUsd: total.costUsd + (cost ?? 0),
    }),
    NO_USAGE,
  )
