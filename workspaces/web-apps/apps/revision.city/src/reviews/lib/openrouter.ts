import {z} from 'zod'

export interface CompletionUsage {
  promptTokens: number
  completionTokens: number
  costUsd: number
}

export const NO_USAGE: CompletionUsage = {promptTokens: 0, completionTokens: 0, costUsd: 0}

export function addUsage(total: CompletionUsage, usage: CompletionUsage): CompletionUsage {
  return {
    promptTokens: total.promptTokens + usage.promptTokens,
    completionTokens: total.completionTokens + usage.completionTokens,
    costUsd: total.costUsd + usage.costUsd,
  }
}

type JsonSchema = Readonly<Record<string, unknown>>

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
}

export interface ToolCall {
  id: string
  name: string
  // The arguments as the model wrote them: JSON text that can be invalid.
  arguments: string
}

export type ChatMessage =
  | {role: 'system' | 'user'; content: string}
  | {role: 'assistant'; content: string; toolCalls: readonly ToolCall[]}
  | {role: 'tool'; toolCallId: string; content: string}

export interface ChatRequest {
  model: string
  messages: readonly ChatMessage[]
  tools?: readonly ToolDefinition[]
  toolChoice?: 'auto' | 'none'
}

export interface ChatReply {
  content: string
  toolCalls: ToolCall[]
  usage: CompletionUsage
  // Why the model stopped, such as "stop", "length", or "tool_calls".
  finishReason?: string
}

export type Chat = (request: ChatRequest) => Promise<ChatReply>

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

export class OpenRouterError extends Error {
  readonly temporary: boolean

  constructor(message: string, temporary: boolean) {
    super(message)
    this.temporary = temporary
  }
}

export interface CreateOpenRouterChatParams {
  apiKey: string
  fetch?: Fetch
  // One wait per retry, so the length sets the retry count. Only temporary
  // failures are retried.
  retryDelaysMs?: readonly number[]
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

const DEFAULT_RETRY_DELAYS_MS = [2000, 8000]

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({name: z.string(), arguments: z.string()}),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      cost: z.number().optional(),
    })
    .optional(),
})

const providerErrorSchema = z.object({message: z.string()})

// After the provider accepts the request, OpenRouter answers 200 even if the
// provider then fails. The error is at the top level, or in the first choice
// next to a partial answer.
const topLevelErrorSchema = z.object({error: providerErrorSchema})
const firstChoiceErrorSchema = z.object({
  choices: z.tuple([z.object({error: providerErrorSchema})], z.unknown()),
})

export function createOpenRouterChat({
  apiKey,
  fetch: fetchImpl = fetch,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
}: CreateOpenRouterChatParams): Chat {
  return async (request) => {
    const init = {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify(toRequestBody(request)),
    }
    const parsed = chatResponseSchema.safeParse(
      await postChat({fetch: fetchImpl, init, retryDelaysMs}),
    )
    if (!parsed.success) {
      throw new OpenRouterError(
        `OpenRouter returned an unexpected response: ${z.prettifyError(parsed.error)}`,
        false,
      )
    }
    const {choices, usage} = parsed.data
    const {message, finish_reason: finishReason} = choices[0]
    return {
      ...(finishReason ? {finishReason} : {}),
      // A refusal or a reply with only tool calls can have no content. An empty
      // final answer keeps the billed usage and then fails to parse.
      content: message.content ?? '',
      toolCalls: (message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        costUsd: usage?.cost ?? 0,
      },
    }
  }
}

// A findings answer is a few thousand tokens, and the reasoning tokens of a
// reasoning model also count. The cap stops a model that repeats itself
// before the answer, which cannot parse, costs a lot.
const MAX_ANSWER_TOKENS = 32_000

function toRequestBody({model, messages, tools, toolChoice}: ChatRequest) {
  return {
    model,
    messages: messages.map(toWireMessage),
    ...(tools === undefined
      ? {}
      : {
          tools: tools.map((tool) => ({type: 'function', function: tool})),
          tool_choice: toolChoice ?? 'auto',
        }),
    // JSON mode while tools are on makes some models write a tool call as
    // JSON text instead of calling the tool.
    ...(tools === undefined || toolChoice === 'none'
      ? {response_format: {type: 'json_object'}}
      : {}),
    max_tokens: MAX_ANSWER_TOKENS,
    temperature: 0,
    // Asks OpenRouter to return the billed cost with the token counts.
    usage: {include: true},
  }
}

function toWireMessage(message: ChatMessage) {
  switch (message.role) {
    case 'assistant':
      return {
        role: 'assistant',
        // Some providers reject an empty text part next to tool calls.
        content: message.content === '' ? null : message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: {name: call.name, arguments: call.arguments},
        })),
      }
    case 'tool':
      return {role: 'tool', tool_call_id: message.toolCallId, content: message.content}
    default:
      return message
  }
}

type ChatAttempt = {body: unknown} | {error: string; temporary: boolean}

interface PostChatParams {
  fetch: Fetch
  init: RequestInit
  retryDelaysMs: readonly number[]
}

async function postChat({fetch: fetchImpl, init, retryDelaysMs}: PostChatParams): Promise<unknown> {
  const attempt = await attemptChat({fetch: fetchImpl, init})
  if ('body' in attempt) {
    return attempt.body
  }
  const [delayMs, ...laterDelaysMs] = retryDelaysMs
  if (!attempt.temporary || delayMs === undefined) {
    throw new OpenRouterError(attempt.error, attempt.temporary)
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs))
  return postChat({fetch: fetchImpl, init, retryDelaysMs: laterDelaysMs})
}

async function attemptChat({
  fetch: fetchImpl,
  init,
}: Omit<PostChatParams, 'retryDelaysMs'>): Promise<ChatAttempt> {
  const response = await fetchImpl(OPENROUTER_CHAT_URL, init).catch((error: unknown) =>
    String(error),
  )
  if (typeof response === 'string') {
    return {error: `OpenRouter request failed: ${response}`, temporary: true}
  }
  if (!response.ok) {
    return {
      error: `OpenRouter returned ${response.status}: ${await response.text()}`,
      temporary: RETRYABLE_STATUSES.has(response.status),
    }
  }
  const body: unknown = await response.json()
  const failure =
    topLevelErrorSchema.safeParse(body).data?.error ??
    firstChoiceErrorSchema.safeParse(body).data?.choices[0].error
  return failure === undefined
    ? {body}
    : {error: `OpenRouter returned an error: ${failure.message}`, temporary: true}
}

// Some models add prose or a Markdown fence around the JSON, even when the prompt
// asks for a JSON object. The prose can quote other JSON, so the answer is the
// first object that matches the schema. `extractJson` tries objects inside other
// objects last, so that an object inside quoted JSON cannot hide an outer answer.
export function extractJson<Value>(text: string, schema: z.ZodType<Value>): Value {
  const objects = parseJsonObjects(text)
  const results = [
    ...objects.filter((object) => !object.nested),
    ...objects.filter((object) => object.nested),
  ].map((object) => schema.safeParse(object.value))
  const match = results.find((result) => result.success)
  if (match?.success) {
    return match.data
  }
  throw results[0]?.error ?? new Error('Model response has no JSON object')
}

// Returns the parse error of the longest top-level object that is not valid JSON,
// to show why `extractJson` found no answer. The answer is most likely the longest
// object, so an invalid example in the prose does not hide the error of the
// answer. An object that does not close runs to the end of the text, so a cut-off
// answer gives an error such as "Unterminated string". The position in the error
// counts from the start of the object.
export function findJsonSyntaxError(text: string): string | undefined {
  let longest: {error: string; length: number} | undefined
  let start = jsonObjectStart(text, 0)
  while (start !== undefined) {
    const end = closingBraceIndex(text, start) ?? text.length - 1
    const length = end + 1 - start
    const error = jsonParseError(text.slice(start, end + 1))
    if (error !== undefined && length > (longest?.length ?? 0)) {
      longest = {error, length}
    }
    start = jsonObjectStart(text, end + 1)
  }
  return longest?.error
}

export function hasJsonObjectStart(text: string): boolean {
  return jsonObjectStart(text, 0) !== undefined
}

// A JSON object starts with a brace, then optional white space, then a quote or a
// closing brace. So a brace in prose, such as `{x}`, does not start one.
function jsonObjectStart(text: string, from: number): number | undefined {
  const pattern = /\{\s*["}]/g
  pattern.lastIndex = from
  return pattern.exec(text)?.index
}

function jsonParseError(text: string): string | undefined {
  try {
    JSON.parse(text)
    return undefined
  } catch (error) {
    return String(error)
  }
}

interface ParsedJsonObject {
  value: unknown
  nested: boolean
}

function parseJsonObjects(text: string): ParsedJsonObject[] {
  const objects: ParsedJsonObject[] = []
  let outerEnd = -1
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = closingBraceIndex(text, start)
    const value = end === undefined ? undefined : tryParseJson(text.slice(start, end + 1))
    if (end !== undefined && value !== undefined) {
      objects.push({value, nested: start < outerEnd})
      outerEnd = Math.max(outerEnd, end)
    }
  }
  return objects
}

function closingBraceIndex(text: string, start: number): number | undefined {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === '\\') {
        index++
      } else if (char === '"') {
        inString = false
      }
    } else if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return index
      }
    }
  }
  return undefined
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
