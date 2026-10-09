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
  choices: z.array(z.object({message: z.object({content: z.string()})})).min(1),
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
      text: parsed.choices[0].message.content,
      usage: {
        promptTokens: parsed.usage?.prompt_tokens ?? 0,
        completionTokens: parsed.usage?.completion_tokens ?? 0,
        costUsd: parsed.usage?.cost ?? 0,
      },
    }
  }
}

const FENCED_BLOCK_PATTERN = /```(?:json)?\s*\n([\s\S]*?)\n```/

// Some models wrap JSON in a Markdown fence, or add prose around it, even when
// asked for a JSON object.
export function extractJson(text: string): unknown {
  const fenced = FENCED_BLOCK_PATTERN.exec(text)?.[1]
  const candidate = fenced ?? text.trim()
  if (candidate.startsWith('{')) {
    return JSON.parse(candidate)
  }
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end < start) {
    throw new Error('Model response has no JSON object')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}
