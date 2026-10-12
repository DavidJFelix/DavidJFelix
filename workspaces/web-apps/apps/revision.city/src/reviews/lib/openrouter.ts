import {z} from 'zod'

export interface CompletionRequest {
  model: string
  system: string
  prompt: string
}

export interface CompletionUsage {
  promptTokens: number
  completionTokens: number
  costUsd: number
}

export interface Completion {
  text: string
  usage: CompletionUsage
}

export type Complete = (request: CompletionRequest) => Promise<Completion>

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

export interface CreateOpenRouterCompleteParams {
  apiKey: string
  fetch?: Fetch
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

const chatResponseSchema = z.object({
  choices: z.array(z.object({message: z.object({content: z.string().nullish()})})).min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      cost: z.number().optional(),
    })
    .optional(),
})

export function createOpenRouterComplete({
  apiKey,
  fetch: fetchImpl = fetch,
}: CreateOpenRouterCompleteParams): Complete {
  return async ({model, system, prompt}) => {
    const response = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        model,
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: prompt},
        ],
        response_format: {type: 'json_object'},
        temperature: 0,
        // Asks OpenRouter to return the billed cost with the token counts.
        usage: {include: true},
      }),
    })
    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}: ${await response.text()}`)
    }
    const parsed = chatResponseSchema.parse(await response.json())
    return {
      // A refusal can have no content. Empty text keeps the billed usage and
      // then fails to parse as an answer.
      text: parsed.choices[0].message.content ?? '',
      usage: {
        promptTokens: parsed.usage?.prompt_tokens ?? 0,
        completionTokens: parsed.usage?.completion_tokens ?? 0,
        costUsd: parsed.usage?.cost ?? 0,
      },
    }
  }
}

// Some models add prose or a Markdown fence around the JSON, even when the prompt
// asks for a JSON object. The prose can quote other JSON, so the answer is the
// first object that matches the schema.
export function extractJson<Value>(text: string, schema: z.ZodType<Value>): Value {
  let firstError: z.ZodError<Value> | undefined
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = closingBraceIndex(text, start)
    const parsed = end === undefined ? undefined : tryParseJson(text.slice(start, end + 1))
    if (parsed !== undefined) {
      const result = schema.safeParse(parsed)
      if (result.success) {
        return result.data
      }
      firstError ??= result.error
    }
  }
  throw firstError ?? new Error('Model response has no JSON object')
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
