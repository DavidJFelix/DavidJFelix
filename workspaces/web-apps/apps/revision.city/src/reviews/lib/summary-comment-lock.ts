// cSpell:ignore unixepoch -- the SQLite date function
import {and, eq, lt, sql} from 'drizzle-orm'
import type {BaseSQLiteDatabase} from 'drizzle-orm/sqlite-core'
import {summaryCommentLocks} from './schema'

// An edit of the summary comment takes a few GitHub requests. A run that stops
// while it holds the lock blocks other runs for at most this time.
const LEASE_SECONDS = 60

export interface SummaryCommentLockParams {
  // Names the pull request, such as "owner/name#7".
  pullRequest: string
  // Names the run, such as its check run id. The same holder can take the
  // lock again, so a retried step does not wait for its own lease.
  holder: string
}

// Lets one run at a time edit the summary comment of a pull request.
export interface SummaryCommentLock {
  // False when another run holds the lock and its lease did not expire.
  acquire: (params: SummaryCommentLockParams) => Promise<boolean>
  release: (params: SummaryCommentLockParams) => Promise<void>
}

// The lease uses the database clock, so all runs compare times from one clock.
export function createSqliteSummaryCommentLock(
  db: BaseSQLiteDatabase<'async', unknown>,
): SummaryCommentLock {
  return {
    acquire: async ({pullRequest, holder}) => {
      const expiresAt = sql`unixepoch() + ${LEASE_SECONDS}`
      await db
        .insert(summaryCommentLocks)
        .values({pullRequest, holder, expiresAt})
        .onConflictDoUpdate({
          target: summaryCommentLocks.pullRequest,
          set: {holder, expiresAt},
          setWhere: sql`${summaryCommentLocks.holder} = ${holder} or ${lt(summaryCommentLocks.expiresAt, sql`unixepoch()`)}`,
        })
      const [row] = await db
        .select({holder: summaryCommentLocks.holder})
        .from(summaryCommentLocks)
        .where(eq(summaryCommentLocks.pullRequest, pullRequest))
      return row?.holder === holder
    },
    release: async ({pullRequest, holder}) => {
      await db
        .delete(summaryCommentLocks)
        .where(
          and(
            eq(summaryCommentLocks.pullRequest, pullRequest),
            eq(summaryCommentLocks.holder, holder),
          ),
        )
    },
  }
}

export function createMemorySummaryCommentLock(): SummaryCommentLock {
  const holders = new Map<string, string>()
  return {
    acquire: async ({pullRequest, holder}) => {
      const current = holders.get(pullRequest) ?? holder
      holders.set(pullRequest, current)
      return current === holder
    },
    release: async ({pullRequest, holder}) => {
      if (holders.get(pullRequest) === holder) {
        holders.delete(pullRequest)
      }
    },
  }
}
