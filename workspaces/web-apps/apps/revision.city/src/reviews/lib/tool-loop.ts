import {
  addUsage,
  type Chat,
  type ChatMessage,
  type ChatReply,
  type ChatRequest,
  type CompletionUsage,
  NO_USAGE,
  OpenRouterError,
  type ToolCall,
  type ToolDefinition,
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
  'The other tools are off now. Call submit_answer with the JSON answer that the instructions give. Leave out each finding that you could not check.'

// When the tools went off, a model that still wanted to read files wrote its
// tool calls as text, which does not parse as an answer. With the answer as a
// tool call, the last round can make the model call this tool and nothing else.
export const SUBMIT_ANSWER_TOOL: ToolDefinition = {
  name: 'submit_answer',
  description:
    'Submits your answer. The arguments are the JSON answer that the instructions give. Call it once, when you are done.',
  parameters: {type: 'object', additionalProperties: true},
}

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
}

export type ToolLoopResult = ToolLoopAnswer | ToolLoopFailure

export function runToolLoop({
  chat,
  model,
  system,
  prompt,
  tools,
  eventFields = {},
}: RunToolLoopParams): Promise<ToolLoopResult> {
  return continueToolLoop({
    chat,
    model,
    tools,
    eventFields,
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
        ? {messages, tools: [...tools.definitions, SUBMIT_ANSWER_TOOL], toolChoice: 'auto'}
        : answerNowRequest(messages)),
  }).catch(toFailure)
  if ('error' in reply) {
    return {error: reply.error, usage: state.usage}
  }
  const usage = addUsage(state.usage, reply.usage)
  const submitted = reply.toolCalls.find(isSubmitAnswer)
  const isLastReply =
    tools === undefined || !mayCallTools || reply.toolCalls.length === 0 || submitted !== undefined
  // A last reply that stopped at the token limit counts as cut: a submit_answer
  // call cut there has arguments that do not parse.
  if (isLastReply && reply.finishReason === 'length') {
    return answerWithoutReasoning({...state, usage})
  }
  if (isLastReply) {
    return toAnswer({reply, usage, reads: state.reads})
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

// A reasoning model can use all of the output token limit to reason, and a
// second run of the review often did the same. This call asks for the answer
// without reasoning, from the files that the model read before the cut. An
// answer without reasoning is short, so it costs less than a second run.
async function answerWithoutReasoning(state: ToolLoopState): Promise<ToolLoopResult> {
  const {chat, model, tools, eventFields, messages, round, reads} = state
  const reply = await chat({
    model,
    eventFields: {...eventFields, round},
    reasoning: 'off',
    ...(tools === undefined ? {messages} : answerNowRequest(messages)),
  }).catch(toFailure)
  if ('error' in reply) {
    return {error: reply.error, usage: state.usage}
  }
  const usage = addUsage(state.usage, reply.usage)
  if (reply.finishReason === 'length') {
    const error = answerText(reply) === '' ? describeEmptyAnswer(reply) : describeCutAnswer(reply)
    return {error, usage}
  }
  return toAnswer({reply, usage, reads})
}

interface ToAnswerParams {
  reply: ChatReply
  usage: CompletionUsage
  reads: readonly FileRead[]
}

function toAnswer({reply, usage, reads}: ToAnswerParams): ToolLoopResult {
  const text = answerText(reply)
  if (text === '') {
    return {error: describeEmptyAnswer(reply), usage}
  }
  const uniqueReads = new Map(reads.map((read) => [read.path, read]))
  return {text, usage, reads: [...uniqueReads.values()]}
}

// A provider that does not support a required tool call can still answer in
// text, and a submit_answer call with empty arguments does not hide that text.
function answerText(reply: ChatReply): string {
  return reply.toolCalls.find(isSubmitAnswer)?.arguments || reply.content
}

function answerNowRequest(messages: readonly ChatMessage[]): Omit<ChatRequest, 'model'> {
  return {
    messages: withAnswerNowNote(messages),
    tools: [SUBMIT_ANSWER_TOOL],
    toolChoice: 'required',
  }
}

// The reason tells an output cut at the token limit from a model that called
// tools when the tools were off. The error is not temporary, so a step retry
// does not bill each empty answer again.
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

function describeCutAnswer({usage}: ChatReply): OpenRouterError {
  return new OpenRouterError(
    `Answer cut at the output token limit: ${usage.completionTokens} output tokens`,
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

function isSubmitAnswer(call: ToolCall): boolean {
  return call.name === SUBMIT_ANSWER_TOOL.name
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
