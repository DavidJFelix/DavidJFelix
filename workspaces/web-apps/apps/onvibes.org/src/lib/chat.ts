// The chat contract between the browser and the worker: what a request may
// carry, what the worker needs to answer it, and which model answers. Pure
// schemas and constants; src/routes/api/chat.ts does the I/O.

import {z} from 'zod'

// OpenRouter model id. The catalog lists the sibling `-pro` and `:batch`
// variants; the plain one is the interactive chat tier.
export const CHAT_MODEL = 'openai/gpt-5.6-luna'

export const SYSTEM_PROMPT = [
  'You are onvibes, a collaborator for people describing an app they want to build fast and by feel.',
  'Help them turn a loose idea into a concrete, small plan: what it does, how it looks, and what to leave out.',
  'Reply in plain text. Be concise and specific; ask one question at a time when something is unclear.',
].join(' ')

// Bounds on one request. The composer never produces more than this; the
// bounds keep a stray client from sending the model an arbitrarily large
// prompt on this app's key.
const MAX_MESSAGES = 200
const MAX_MESSAGE_LENGTH = 20_000

const idSchema = z.string().min(1).max(128)
const textSchema = z.string().max(MAX_MESSAGE_LENGTH)

// The TanStack AI client serializes each turn as an AG-UI message. Only the two
// roles the shell renders are accepted, and content must be text: a user turn
// is a string, an assistant turn a string or -- after a run that produced no
// text -- nothing at all. Every other key on the wire (`id`, `metadata`) is
// dropped.
const userTurnSchema = z.object({role: z.literal('user'), content: textSchema.min(1)})
const assistantTurnSchema = z.object({role: z.literal('assistant'), content: textSchema.optional()})
const turnSchema = z.discriminatedUnion('role', [userTurnSchema, assistantTurnSchema])

const modelMessageSchema = z.object({role: z.enum(['user', 'assistant']), content: z.string()})

export const chatRequestSchema = z.object({
  threadId: idSchema.optional(),
  runId: idSchema.optional(),
  messages: z
    .array(turnSchema)
    .max(MAX_MESSAGES)
    // An assistant turn without text carries nothing for the model; drop it
    // rather than reject the retry that follows a failed run.
    .transform((turns) =>
      turns.flatMap((turn) =>
        turn.content === undefined ? [] : [{role: turn.role, content: turn.content}],
      ),
    )
    .pipe(z.array(modelMessageSchema).min(1)),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

// The worker binding the endpoint needs. Set with `wrangler secret put
// OPENROUTER_API_KEY`; `.dev.vars` locally (see .dev.vars.example).
export const chatEnvSchema = z.object({OPENROUTER_API_KEY: z.string().min(1)})
