// The D1 schema (Drizzle, SQLite dialect). `drizzle-kit generate` (the
// `db:generate` task) diffs this file against drizzle/meta and writes the next
// migration into drizzle/; wrangler applies those to the bound database.
//
// Accounts are identity-only: a user is a display name, and each way they can
// prove who they are is an authentication row pointing at them. There are no
// passwords -- sign-in is delegated to an OpenID Connect provider, so the
// credential the app stores is the provider's own stable subject id.
// cSpell:words authn

import {sqliteTable, text, unique} from 'drizzle-orm/sqlite-core'
import {newId} from './ids'

// The identity providers a user can sign in with. Google is the only one for
// now; adding one means adding it here and generating a migration, because the
// column is constrained to this list.
export const AUTH_PROVIDERS = ['google'] as const
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => newId({prefix: 'user'})),
  fullName: text('full_name').notNull(),
})

export const authentications = sqliteTable(
  'authentications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => newId({prefix: 'authn'})),
    provider: text('provider', {enum: AUTH_PROVIDERS}).notNull(),
    // What the provider calls this person. For Google's OpenID Connect flow
    // that is the `sub` claim of the id token: a numeric string that never
    // changes for the account, unlike the email address (which Google allows
    // to be changed and which can be reassigned after deletion).
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
  },
  // One provider identity maps to at most one user: the pair is the natural
  // key a sign-in looks up by.
  (table) => [unique().on(table.provider, table.providerId)],
)

export type User = typeof users.$inferSelect
export type Authentication = typeof authentications.$inferSelect
