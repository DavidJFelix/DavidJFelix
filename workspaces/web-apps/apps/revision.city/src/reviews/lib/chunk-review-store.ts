import {z} from 'zod'
import {modelFindingSchema} from './findings'

const chunkReviewResultSchema = z.object({
  findings: z.array(modelFindingSchema),
  usage: z.object({promptTokens: z.number(), completionTokens: z.number(), costUsd: z.number()}),
})

export type ChunkReviewResult = z.infer<typeof chunkReviewResultSchema>

// Saved model answers, keyed by everything that decides the answer, so a
// re-run pays only for chunks whose content, model, or prompt changed.
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

// Increment to discard every saved result, for example after a change to how
// results are parsed.
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

export function createD1ChunkReviewStore(db: D1Database): ChunkReviewStore {
  return {
    get: async (key) => {
      const row = await db
        .prepare('SELECT result FROM chunk_reviews WHERE key = ?')
        .bind(key)
        .first<{result: string}>()
      return row ? chunkReviewResultSchema.parse(JSON.parse(row.result)) : undefined
    },
    put: async (key, result) => {
      await db
        .prepare(
          'INSERT INTO chunk_reviews (key, result) VALUES (?, ?) ON CONFLICT (key) DO NOTHING',
        )
        .bind(key, JSON.stringify(result))
        .run()
    },
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
