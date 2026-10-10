import {sql} from 'drizzle-orm'
import {sqliteTable, text} from 'drizzle-orm/sqlite-core'

export const chunkReviews = sqliteTable('chunk_reviews', {
  key: text('key').primaryKey(),
  // The column stores JSON as plain text, not in drizzle's JSON mode. The store
  // parses it, so a row that does not parse is a miss, not an error.
  result: text('result').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})
