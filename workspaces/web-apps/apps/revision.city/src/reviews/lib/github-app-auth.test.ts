// @vitest-environment node

import {generateKeyPairSync, verify} from 'node:crypto'
import {expect, test, vi} from 'vitest'
import {createAppJwt, createInstallationTokenSource} from './github-app-auth'
import type {Fetch} from './openrouter'

const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048})
// GitHub gives app keys in PKCS#1.
const pkcs1Key = privateKey.export({type: 'pkcs1', format: 'pem'})
const pkcs8Key = privateKey.export({type: 'pkcs8', format: 'pem'})

function decodeJwt(jwt: string): {header: unknown; payload: unknown; signed: boolean} {
  const [header, payload, signature] = jwt.split('.')
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString()),
    signed: verify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  }
}

test.each([
  {format: 'PKCS#1', key: pkcs1Key},
  {format: 'PKCS#8', key: pkcs8Key},
])('createAppJwt signs the claims with a $format key', async ({key}) => {
  const jwt = await createAppJwt({clientId: 'Iv1.app', privateKey: key, nowSeconds: 1_000_000})

  expect(decodeJwt(jwt)).toEqual({
    header: {alg: 'RS256', typ: 'JWT'},
    payload: {iat: 999_940, exp: 1_000_540, iss: 'Iv1.app'},
    signed: true,
  })
})

test('createAppJwt rejects a key that is not PEM', async () => {
  await expect(
    createAppJwt({clientId: 'Iv1.app', privateKey: 'not a key', nowSeconds: 0}),
  ).rejects.toThrow('The GitHub App private key is not in PEM format')
})

test('createAppJwt rejects a PEM block that is not a private key', async () => {
  const publicPem = publicKey.export({type: 'spki', format: 'pem'})

  await expect(
    createAppJwt({clientId: 'Iv1.app', privateKey: publicPem, nowSeconds: 0}),
  ).rejects.toThrow('The GitHub App private key has an unsupported PEM label: PUBLIC KEY')
})

const tokenResponse = (token: string, expiresAt: string): Response =>
  Response.json({token, expires_at: expiresAt})

const sourceParams = {clientId: 'Iv1.app', privateKey: pkcs1Key, installationId: 5, repositoryId: 9}

test('createInstallationTokenSource requests one token for one repository and shares it', async () => {
  const fetchStub = vi.fn<Fetch>(async () => tokenResponse('ghs_1', '2026-10-12T13:00:00Z'))
  const tokenSource = createInstallationTokenSource({
    ...sourceParams,
    fetch: fetchStub,
    now: () => Date.parse('2026-10-12T12:00:00Z'),
  })

  expect(await Promise.all([tokenSource(), tokenSource()])).toEqual(['ghs_1', 'ghs_1'])
  expect(await tokenSource()).toBe('ghs_1')

  expect(fetchStub).toHaveBeenCalledTimes(1)
  const [url, init] = fetchStub.mock.calls[0]
  expect(url).toBe('https://api.github.com/app/installations/5/access_tokens')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(
    JSON.stringify({
      repository_ids: [9],
      permissions: {checks: 'write', contents: 'read', pull_requests: 'write'},
    }),
  )
  const jwt = new Headers(init.headers).get('authorization')?.replace('Bearer ', '') ?? ''
  expect(decodeJwt(jwt)).toMatchObject({payload: {iss: 'Iv1.app'}, signed: true})
})

test('createInstallationTokenSource requests a new token 5 minutes before the last one expires', async () => {
  const fetchStub = vi
    .fn<Fetch>()
    .mockResolvedValueOnce(tokenResponse('ghs_1', '2026-10-12T13:00:00Z'))
    .mockResolvedValueOnce(tokenResponse('ghs_2', '2026-10-12T14:00:00Z'))
  let nowMs = Date.parse('2026-10-12T12:00:00Z')
  const tokenSource = createInstallationTokenSource({
    ...sourceParams,
    fetch: fetchStub,
    now: () => nowMs,
  })

  expect(await tokenSource()).toBe('ghs_1')
  nowMs = Date.parse('2026-10-12T12:54:59Z')
  expect(await tokenSource()).toBe('ghs_1')
  nowMs = Date.parse('2026-10-12T12:55:00Z')
  expect(await tokenSource()).toBe('ghs_2')
})

test('createInstallationTokenSource requests a token again after a failed request', async () => {
  const fetchStub = vi
    .fn<Fetch>()
    .mockResolvedValueOnce(new Response('permissions not granted', {status: 422}))
    .mockResolvedValueOnce(tokenResponse('ghs_1', '2026-10-12T13:00:00Z'))
  const tokenSource = createInstallationTokenSource({
    ...sourceParams,
    fetch: fetchStub,
    now: () => Date.parse('2026-10-12T12:00:00Z'),
  })

  await expect(tokenSource()).rejects.toThrow('GitHub returned 422')
  expect(await tokenSource()).toBe('ghs_1')
})
