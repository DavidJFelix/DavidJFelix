import {sql} from 'drizzle-orm'
import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'

export const chunkReviews = sqliteTable('chunk_reviews', {
  key: text('key').primaryKey(),
  // The column stores JSON as plain text, not in drizzle's JSON mode. The store
  // parses it, so a row that does not parse is a miss, not an error.
  result: text('result').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// One row while a run edits the summary comment of a pull request, so that two
// runs do not edit it at the same time.
export const summaryCommentLocks = sqliteTable('summary_comment_locks', {
  pullRequest: text('pull_request').primaryKey(),
  holder: text('holder').notNull(),
  // Seconds since the Unix epoch, from the database clock. After this time
  // another run can take the lock, also when the holder did not release it.
  expiresAt: integer('expires_at').notNull(),
})
