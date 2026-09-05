import {expect, test} from 'bun:test'
import {accessHeaders, isAccessLogin} from './cloudflare-access'

test('accessHeaders carries the service token as the two Access headers', () => {
  // given
  const env = {CF_ACCESS_CLIENT_ID: 'id.access', CF_ACCESS_CLIENT_SECRET: 'shh'}

  // when
  const headers = accessHeaders(env)

  // then
  expect(headers).toEqual({'CF-Access-Client-Id': 'id.access', 'CF-Access-Client-Secret': 'shh'})
})

test.each([
  ['nothing set', {}],
  ['only the id', {CF_ACCESS_CLIENT_ID: 'id.access'}],
  ['only the secret', {CF_ACCESS_CLIENT_SECRET: 'shh'}],
  ['empty strings', {CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: ''}],
])('accessHeaders sends nothing with %s', (_name, env) => {
  // when
  const headers = accessHeaders(env)

  // then
  expect(headers).toEqual({})
})

test.each([
  ['the Access login page', 'https://acct.cloudflareaccess.com/cdn-cgi/access/login/x?kid=1', true],
  ['the app itself', 'https://pr-1-app.acct.workers.dev/', false],
  ['a look-alike host', 'https://cloudflareaccess.com.evil.example/', false],
  ['a response without a url', '', false],
])('isAccessLogin recognizes %s', (_name, url, expected) => {
  // when
  const login = isAccessLogin({url})

  // then
  expect(login).toBe(expected)
})
