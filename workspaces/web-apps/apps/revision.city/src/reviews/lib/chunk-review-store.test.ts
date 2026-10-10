// @vitest-environment node

import {DatabaseSync, type SQLInputValue} from 'node:sqlite'
import {fileURLToPath} from 'node:url'
import {drizzle} from 'drizzle-orm/sqlite-proxy'
import {migrate} from 'drizzle-orm/sqlite-proxy/migrator'
import {expect, test} from 'vitest'
import {chunkReviewKey, createSqliteChunkReviewStore} from './chunk-review-store'

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

// D1 is SQLite, so the store runs the same SQL here as in the worker.
async function createMigratedDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  const db = drizzle(async (sql, params: SQLInputValue[], method) => {
    const statement = sqlite.prepare(sql)
    if (method === 'run') {
      statement.run(...params)
      return {rows: []}
    }
    return {rows: statement.all(...params).map((row) => Object.values(row))}
  })
  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))
  await migrate(
    db,
    async (queries) => {
      for (const query of queries) {
        sqlite.exec(query)
      }
    },
    {migrationsFolder},
  )
  return {db, sqlite}
}

test('createSqliteChunkReviewStore returns what it saved and nothing for an unknown key', async () => {
  const store = createSqliteChunkReviewStore((await createMigratedDatabase()).db)

  await store.put('key', result)

  expect(await store.get('key')).toEqual(result)
  expect(await store.get('missing')).toBeUndefined()
})

test('createSqliteChunkReviewStore treats a row that fails the schema as a miss and replaces it', async () => {
  const {db, sqlite} = await createMigratedDatabase()
  sqlite
    .prepare('INSERT INTO chunk_reviews (key, result) VALUES (?, ?)')
    .run('key', '{"findings": "old"}')
  const store = createSqliteChunkReviewStore(db)

  expect(await store.get('key')).toBeUndefined()
  await store.put('key', result)
  expect(await store.get('key')).toEqual(result)
})
