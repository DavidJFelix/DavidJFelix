import {getTableName} from 'drizzle-orm'
import {getTableConfig} from 'drizzle-orm/sqlite-core'
import {expect, test} from 'vitest'
import {AUTH_PROVIDERS, authentications, users} from './schema'

// cSpell:words authn

// These pin the shape of the schema -- the constraints a sign-in relies on --
// without a database: Drizzle exposes what it will emit into a migration.

test('a user is an id and a full name, keyed by the id', () => {
  // when
  const {name, columns} = getTableConfig(users)

  // then
  expect(name).toBe('users')
  expect(columns.map((column) => column.name)).toEqual(['id', 'full_name'])
  expect(columns.find((column) => column.name === 'id')?.primary).toBe(true)
  expect(columns.every((column) => column.notNull)).toBe(true)
})

test('an authentication is keyed by its id and constrained to the known providers', () => {
  // when
  const {name, columns} = getTableConfig(authentications)

  // then
  expect(name).toBe('authentications')
  expect(columns.map((column) => column.name)).toEqual(['id', 'provider', 'provider_id', 'user_id'])
  expect(columns.find((column) => column.name === 'id')?.primary).toBe(true)
  expect(columns.find((column) => column.name === 'provider')?.enumValues).toEqual(['google'])
  expect(columns.every((column) => column.notNull)).toBe(true)
})

test('google is the only provider for now', () => {
  // then
  expect(AUTH_PROVIDERS).toEqual(['google'])
})

test('an authentication belongs to a user and goes away with them', () => {
  // when
  const {foreignKeys} = getTableConfig(authentications)
  const [userLink] = foreignKeys.map((key) => key.reference())

  // then
  expect(foreignKeys).toHaveLength(1)
  expect(userLink?.columns.map((column) => column.name)).toEqual(['user_id'])
  expect(getTableName(userLink?.foreignTable ?? users)).toBe('users')
  expect(userLink?.foreignColumns.map((column) => column.name)).toEqual(['id'])
  expect(foreignKeys[0]?.onDelete).toBe('cascade')
})

test('a provider identity maps to at most one user', () => {
  // when
  const {uniqueConstraints} = getTableConfig(authentications)

  // then
  expect(uniqueConstraints).toHaveLength(1)
  expect(uniqueConstraints[0]?.columns.map((column) => column.name)).toEqual([
    'provider',
    'provider_id',
  ])
})

test('new rows mint prefixed ids by default', () => {
  // when
  const userId = getTableConfig(users)
    .columns.find((column) => column.name === 'id')
    ?.defaultFn?.()
  const authenticationId = getTableConfig(authentications)
    .columns.find((column) => column.name === 'id')
    ?.defaultFn?.()

  // then
  // cSpell:ignore HJKMNP -- a run of the Crockford alphabet inside the character class
  expect(userId).toMatch(/^user_[0-9A-HJKMNP-TV-Z]{26}$/u)
  expect(authenticationId).toMatch(/^authn_[0-9A-HJKMNP-TV-Z]{26}$/u)
})
