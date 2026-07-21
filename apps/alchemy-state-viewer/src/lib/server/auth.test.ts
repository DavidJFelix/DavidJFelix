import {expect, test} from 'vitest'
import {parseBasicAuth, unauthorizedResponse, verifyPassword} from './auth'

const basic = (user: string, pass: string): string => `Basic ${btoa(`${user}:${pass}`)}`

test('parseBasicAuth decodes user and password', () => {
  expect(parseBasicAuth(basic('me', 'hunter2'))).toEqual({user: 'me', pass: 'hunter2'})
})

test('parseBasicAuth keeps colons in the password', () => {
  expect(parseBasicAuth(basic('me', 'a:b:c'))).toEqual({user: 'me', pass: 'a:b:c'})
})

test.each([
  ['missing header', null],
  ['wrong scheme', 'Bearer abc'],
  ['not base64', 'Basic {{{{'],
  ['no colon in payload', `Basic ${btoa('no-separator')}`],
  ['empty string', ''],
])('parseBasicAuth returns undefined for %s', (_name, header) => {
  expect(parseBasicAuth(header)).toBeUndefined()
})

test('verifyPassword accepts the exact password', async () => {
  expect(await verifyPassword('correct horse', 'correct horse')).toBe(true)
})

test.each([
  ['wrong password', 'wrong'],
  ['prefix only', 'correct'],
  ['empty supplied', ''],
])('verifyPassword rejects %s', async (_name, supplied) => {
  expect(await verifyPassword(supplied, 'correct horse')).toBe(false)
})

test('unauthorizedResponse is a 401 with a basic challenge', () => {
  const response = unauthorizedResponse()
  expect(response.status).toBe(401)
  expect(response.headers.get('www-authenticate')).toContain('Basic')
})
