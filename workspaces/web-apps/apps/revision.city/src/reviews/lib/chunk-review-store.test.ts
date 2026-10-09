import {expect, test} from 'vitest'
import {chunkReviewKey, createD1ChunkReviewStore} from './chunk-review-store'

const keyParams = {model: 'vendor/model', reviewerId: 'security', systemPrompt: 'p', chunkText: 't'}
const result = {findings: [], usage: {promptTokens: 1, completionTokens: 1, costUsd: 0.1}}

test('chunkReviewKey is a stable hex digest of its inputs', async () => {
  const key = await chunkReviewKey(keyParams)

  expect(key).toMatch(/^[0-9a-f]{64}$/)
  expect(await chunkReviewKey({...keyParams})).toBe(key)
})

test.each(['model', 'reviewerId', 'systemPrompt', 'chunkText'] as const)(
  'chunkReviewKey changes when %s changes',
  async (field) => {
    expect(await chunkReviewKey({...keyParams, [field]: 'other'})).not.toBe(
      await chunkReviewKey(keyParams),
    )
  },
)

// Implements only the D1 calls the store makes.
function createFakeD1() {
  const rows = new Map<string, string>()
  const prepare = (sql: string) => ({
    bind: (...values: string[]) => ({
      first: async () => {
        const saved = rows.get(values[0])
        return saved === undefined ? null : {result: saved}
      },
      run: async () => {
        if (sql.startsWith('INSERT') && !rows.has(values[0])) {
          rows.set(values[0], values[1])
        }
      },
    }),
  })
  return {prepare} as unknown as D1Database
}

test('createD1ChunkReviewStore returns what it saved and nothing for an unknown key', async () => {
  const store = createD1ChunkReviewStore(createFakeD1())

  await store.put('key', result)

  expect(await store.get('key')).toEqual(result)
  expect(await store.get('missing')).toBeUndefined()
})
