// cSpell:ignore unixepoch -- the SQLite date function

import {DatabaseSync, type SQLInputValue} from 'node:sqlite'
import {fileURLToPath} from 'node:url'
import {drizzle} from 'drizzle-orm/sqlite-proxy'
import {migrate} from 'drizzle-orm/sqlite-proxy/migrator'
import {expect, test} from 'vitest'
import {
  createMemorySummaryCommentLock,
  createSqliteSummaryCommentLock,
  type SummaryCommentLock,
} from './summary-comment-lock'

const pullRequest = 'acme/repo#7'
const first = {pullRequest, holder: 'check-run:1'}
const second = {pullRequest, holder: 'check-run:2'}

// D1 is SQLite, so the lock runs the same SQL here as in the worker.
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

const locks: [string, () => Promise<SummaryCommentLock>][] = [
  ['sqlite', async () => createSqliteSummaryCommentLock((await createMigratedDatabase()).db)],
  ['memory', async () => createMemorySummaryCommentLock()],
]

test.each(locks)('the %s lock lets one holder at a time take it', async (_name, create) => {
  const lock = await create()

  expect(await lock.acquire(first)).toBe(true)
  expect(await lock.acquire(second)).toBe(false)
  expect(await lock.acquire(first)).toBe(true)
  expect(await lock.acquire({pullRequest: 'acme/repo#8', holder: 'check-run:2'})).toBe(true)
})

test.each(locks)('the %s lock frees on a release by its holder only', async (_name, create) => {
  const lock = await create()
  await lock.acquire(first)

  await lock.release(second)
  expect(await lock.acquire(second)).toBe(false)
  await lock.release(first)
  expect(await lock.acquire(second)).toBe(true)
})

test('the sqlite lock goes to another holder after the lease expires', async () => {
  const {db, sqlite} = await createMigratedDatabase()
  const lock = createSqliteSummaryCommentLock(db)
  await lock.acquire(first)

  sqlite.exec('update summary_comment_locks set expires_at = unixepoch() - 1')

  expect(await lock.acquire(second)).toBe(true)
  expect(await lock.acquire(first)).toBe(false)
})
