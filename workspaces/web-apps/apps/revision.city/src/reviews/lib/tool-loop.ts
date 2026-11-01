import {
  addUsage,
  type Chat,
  type ChatMessage,
  type ChatReply,
  type ChatRequest,
  type CompletionUsage,
  NO_USAGE,
  OpenRouterError,
} from './openrouter'
import type {FileRead} from './repository-snapshot'
import {cutText, type ReviewTools, type ToolOutput} from './review-tools'

// Each round re-sends the whole conversation, so these limits also bound the
// cost of one chunk review.
export const MAX_TOOL_ROUNDS = 4
const MAX_TOOL_CALLS_PER_ROUND = 6
const MAX_TOOL_OUTPUT_CHARS = 48_000

const CUT_NOTE =
  '\n(Cut: the tool output limit for this review is used up. Answer with what you have.)'

const ANSWER_NOW_NOTE =
  'The tools are off now. Write your answer as the JSON that the instructions give. Do not write a tool call. Leave out each finding that you could not check.'

const NOT_RUN: ToolOutput = {content: 'Not run: too many tool calls in one turn.'}

export interface RunToolLoopParams {
  chat: Chat
  model: string
  system: string
  prompt: string
  // Without tools, the model answers in one call.
  tools?: ReviewTools
  eventFields?: ChatRequest['eventFields']
}

interface ToolLoopAnswer {
  text: string
  usage: CompletionUsage
  // Every path that a tool looked up, once per path.
  reads: FileRead[]
}

// The usage counts each model call before the failure, because the provider
// bills them.
interface ToolLoopFailure {
  error: unknown
  usage: CompletionUsage
  // The reasoning used up the output token limit before the answer.
  cutAtTokenLimit?: true
}

export type ToolLoopResult = ToolLoopAnswer | ToolLoopFailure

// At temperature 1, a second run of a review that the token limit cut short
// reasons differently, so it often finishes. A third run is not worth its cost.
export async function runToolLoop(params: RunToolLoopParams): Promise<ToolLoopResult> {
  const first = await startToolLoop({...params, run: 1})
  if (!('cutAtTokenLimit' in first)) {
    return first
  }
  const second = await startToolLoop({...params, run: 2})
  return {...second, usage: addUsage(first.usage, second.usage)}
}

interface StartToolLoopParams extends RunToolLoopParams {
  run: number
}

function startToolLoop({
  chat,
  model,
  system,
  prompt,
  tools,
  eventFields,
  run,
}: StartToolLoopParams): Promise<ToolLoopResult> {
  return continueToolLoop({
    chat,
    model,
    tools,
    eventFields: {...eventFields, run},
    messages: [
      {role: 'system', content: system},
      {role: 'user', content: prompt},
    ],
    round: 0,
    usage: NO_USAGE,
    outputBudget: MAX_TOOL_OUTPUT_CHARS,
    reads: [],
  })
}

interface ToolLoopState {
  chat: Chat
  model: string
  tools?: ReviewTools
  eventFields: NonNullable<ChatRequest['eventFields']>
  messages: readonly ChatMessage[]
  round: number
  usage: CompletionUsage
  outputBudget: number
  reads: readonly FileRead[]
}

async function continueToolLoop(state: ToolLoopState): Promise<ToolLoopResult> {
  const {chat, model, tools, eventFields, messages, round, outputBudget} = state
  const mayCallTools = round < MAX_TOOL_ROUNDS && outputBudget > 0
  const reply = await chat({
    model,
    eventFields: {...eventFields, round},
    ...(tools === undefined
      ? {messages}
      : mayCallTools
        ? {messages, tools: tools.definitions, toolChoice: 'auto'}
        : {
            messages: withAnswerNowNote(messages),
            tools: tools.definitions,
            toolChoice: 'none',
          }),
  }).catch(toFailure)
  if ('error' in reply) {
    return {error: reply.error, usage: state.usage}
  }
  const usage = addUsage(state.usage, reply.usage)
  const isLastReply = tools === undefined || !mayCallTools || reply.toolCalls.length === 0
  if (isLastReply && reply.content === '') {
    const cutAtTokenLimit = reply.toolCalls.length === 0 && reply.finishReason === 'length'
    return {error: describeEmptyAnswer(reply), usage, ...(cutAtTokenLimit ? {cutAtTokenLimit} : {})}
  }
  if (isLastReply) {
    const reads = new Map(state.reads.map((read) => [read.path, read]))
    return {text: reply.content, usage, reads: [...reads.values()]}
  }
  const outputs = await Promise.all(
    reply.toolCalls.map((call, index) =>
      index < MAX_TOOL_CALLS_PER_ROUND ? tools.run(call) : Promise.resolve(NOT_RUN),
    ),
  ).catch(toFailure)
  if ('error' in outputs) {
    return {error: outputs.error, usage}
  }
  const contents = fitToBudget(
    outputs.map((output) => output.content),
    outputBudget,
  )
  return continueToolLoop({
    ...state,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: reply.content,
        toolCalls: reply.toolCalls,
        ...(reply.reasoning ? {reasoning: reply.reasoning} : {}),
      },
      ...reply.toolCalls.map((call, index): ChatMessage => ({
        role: 'tool',
        toolCallId: call.id,
        content: contents[index],
      })),
    ],
    round: round + 1,
    usage,
    outputBudget: outputs.reduce((budget, output) => budget - output.content.length, outputBudget),
    reads: [...state.reads, ...outputs.flatMap((output) => (output.read ? [output.read] : []))],
  })
}

// The reason tells an output cut at the token limit from a model that called
// tools when the tools were off. The error is not temporary, so a step retry
// does not bill each empty answer again; runToolLoop runs a cut review once more.
function describeEmptyAnswer({toolCalls, finishReason, usage}: ChatReply): OpenRouterError {
  const reason =
    toolCalls.length > 0
      ? `tool calls after the tools were off: ${toolCalls.length}`
      : `finish reason ${finishReason ?? 'not given'}`
  return new OpenRouterError(
    `Empty answer: ${reason}, ${usage.completionTokens} output tokens`,
    false,
  )
}

// A user message after the tool results made a model write that message back
// as its JSON answer. The note goes at the end of the last message, which is a
// tool result, instead.
function withAnswerNowNote(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.map((message, index) =>
    index === messages.length - 1
      ? {...message, content: `${message.content}\n\n${ANSWER_NOW_NOTE}`}
      : message,
  )
}

function toFailure(error: unknown): {error: unknown} {
  return {error}
}

function fitToBudget(contents: readonly string[], budget: number): string[] {
  let remaining = budget
  return contents.map((content) => {
    const fitted =
      content.length <= remaining
        ? content
        : `${cutText(content, Math.max(0, remaining))}${CUT_NOTE}`
    remaining -= content.length
    return fitted
  })
}
