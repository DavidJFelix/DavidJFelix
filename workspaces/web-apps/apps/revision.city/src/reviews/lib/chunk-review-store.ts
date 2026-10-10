import {eq} from 'drizzle-orm'
import type {BaseSQLiteDatabase} from 'drizzle-orm/sqlite-core'
import {z} from 'zod'
import {modelFindingSchema} from './findings'
import {chunkReviews} from './schema'

const chunkReviewResultSchema = z.object({
  findings: z.array(modelFindingSchema),
  usage: z.object({promptTokens: z.number(), completionTokens: z.number(), costUsd: z.number()}),
})

export type ChunkReviewResult = z.infer<typeof chunkReviewResultSchema>

// Saved model answers, keyed by the chunk text, model, reviewer, and system prompt.
export interface ChunkReviewStore {
  get: (key: string) => Promise<ChunkReviewResult | undefined>
  put: (key: string, result: ChunkReviewResult) => Promise<void>
}

export interface ChunkReviewKeyParams {
  model: string
  reviewerId: string
  systemPrompt: string
  chunkText: string
}

// Increment to ignore every saved result, for example after a change to the
// OpenRouter request settings or to how answers are parsed.
const KEY_VERSION = 1

export async function chunkReviewKey({
  model,
  reviewerId,
  systemPrompt,
  chunkText,
}: ChunkReviewKeyParams): Promise<string> {
  const material = JSON.stringify([KEY_VERSION, model, reviewerId, systemPrompt, chunkText])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createSqliteChunkReviewStore(
  db: BaseSQLiteDatabase<'async', unknown>,
): ChunkReviewStore {
  return {
    get: async (key) => {
      const [row] = await db
        .select({result: chunkReviews.result})
        .from(chunkReviews)
        .where(eq(chunkReviews.key, key))
      // A row that no longer matches the schema is a miss, and the next put
      // replaces it.
      return row ? parseSavedResult(row.result) : undefined
    },
    put: async (key, result) => {
      const text = JSON.stringify(result)
      await db
        .insert(chunkReviews)
        .values({key, result: text})
        .onConflictDoUpdate({target: chunkReviews.key, set: {result: text}})
    },
  }
}

function parseSavedResult(text: string): ChunkReviewResult | undefined {
  try {
    return chunkReviewResultSchema.parse(JSON.parse(text))
  } catch {
    return undefined
  }
}

export function createMemoryChunkReviewStore(): ChunkReviewStore {
  const results = new Map<string, ChunkReviewResult>()
  return {
    get: async (key) => results.get(key),
    put: async (key, result) => {
      results.set(key, result)
    },
  }
}
