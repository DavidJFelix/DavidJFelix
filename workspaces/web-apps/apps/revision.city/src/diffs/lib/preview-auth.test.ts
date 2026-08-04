import {expect, test} from 'vitest'

import type {GitHubAuthSession} from './github-auth'
import {
  createVerifier,
  deriveChallenge,
  importHandoffKey,
  isPreviewHost,
  openHandoff,
  parsePreviewOrigin,
  sealHandoff,
} from './preview-auth'

const SESSION: GitHubAuthSession = {
  accessToken: 'ghu_secret-token',
  login: 'e2e-user',
  avatarUrl: 'https://avatars.test/i.png',
}

const KEY_SECRET = btoa(String.fromCodePoint(...new Uint8Array(32).fill(7)))
const key = await importHandoffKey(KEY_SECRET)
if (key === undefined) {
  throw new Error('test key failed to import')
}

test.each([
  ['pr-409-revision-city.nullserve.workers.dev', true],
  ['pr-7-f311x.nullserve.workers.dev', true],
  ['revision-city.nullserve.workers.dev', false],
  ['revision.city', false],
  ['pr-409-revision-city.nullserve.workers.dev.evil.test', false],
  ['evil.test', false],
  ['pr-abc-revision-city.nullserve.workers.dev', false],
])('treats %s as a preview host: %s', (hostname, expected) => {
  expect(isPreviewHost(hostname)).toBe(expected)
})

test.each([
  [
    'https://pr-409-revision-city.nullserve.workers.dev',
    'https://pr-409-revision-city.nullserve.workers.dev',
  ],
  [
    'https://pr-409-revision-city.nullserve.workers.dev/diffs?x=1',
    'https://pr-409-revision-city.nullserve.workers.dev',
  ],
])('accepts the preview origin %s', (input, expected) => {
  expect(parsePreviewOrigin(input)).toBe(expected)
})

test.each([
  ['a non-preview host', 'https://revision.city'],
  ['plain http', 'http://pr-409-revision-city.nullserve.workers.dev'],
  ['an unrelated site', 'https://evil.test'],
  ['a host that only ends with the preview pattern', 'https://evil.test/pr-409-x.y.workers.dev'],
  ['nonsense', 'not-a-url'],
  ['nothing', null],
])('refuses to hand a token to %s', (_case, value) => {
  expect(parsePreviewOrigin(value)).toBeUndefined()
})

test('round-trips a session to the holder of the verifier', async () => {
  const verifier = createVerifier()
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(verifier),
    key,
    session: SESSION,
  })

  await expect(openHandoff({handoff, key, verifier})).resolves.toEqual(SESSION)
})

test('keeps the token out of the handoff in readable form', async () => {
  const verifier = createVerifier()
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(verifier),
    key,
    session: SESSION,
  })

  // The handoff travels in a redirect URL, so it lands in browser history and
  // any proxy log along the way.
  expect(handoff).not.toContain(SESSION.accessToken)
  expect(
    atob(handoff.split('.')[2]?.replaceAll('-', '+').replaceAll('_', '/') ?? ''),
  ).not.toContain('ghu_')
})

test('refuses a handoff redeemed with the wrong verifier', async () => {
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(createVerifier()),
    key,
    session: SESSION,
  })

  // Someone who scraped the handoff out of a log still cannot redeem it.
  await expect(openHandoff({handoff, key, verifier: createVerifier()})).resolves.toBeUndefined()
})

test('refuses a handoff past its expiry', async () => {
  const verifier = createVerifier()
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(verifier),
    key,
    session: SESSION,
    now: 1_000_000,
  })

  await expect(
    openHandoff({handoff, key, verifier, now: 1_000_000 + 61_000}),
  ).resolves.toBeUndefined()
})

test('refuses a handoff sealed with a different key', async () => {
  const verifier = createVerifier()
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(verifier),
    key,
    session: SESSION,
  })
  const otherKey = await importHandoffKey(btoa(String.fromCodePoint(...new Uint8Array(32).fill(9))))
  if (otherKey === undefined) {
    throw new Error('test key failed to import')
  }

  await expect(openHandoff({handoff, key: otherKey, verifier})).resolves.toBeUndefined()
})

test.each([
  ['a truncated handoff', 'v1.abc'],
  ['an unknown version', 'v2.abc.def'],
  ['garbage', 'not-a-handoff'],
])('refuses %s', async (_case, handoff) => {
  await expect(openHandoff({handoff, key, verifier: createVerifier()})).resolves.toBeUndefined()
})

test('refuses a tampered ciphertext', async () => {
  const verifier = createVerifier()
  const handoff = await sealHandoff({
    challenge: await deriveChallenge(verifier),
    key,
    session: SESSION,
  })
  const [version, iv, sealed] = handoff.split('.')
  const flipped = `${sealed?.slice(0, -2)}${sealed?.endsWith('AA') === true ? 'BB' : 'AA'}`

  await expect(
    openHandoff({handoff: `${version}.${iv}.${flipped}`, key, verifier}),
  ).resolves.toBeUndefined()
})

test('gives every sign-in a distinct verifier', () => {
  const verifiers = new Set(Array.from({length: 50}, () => createVerifier()))

  expect(verifiers.size).toBe(50)
})

test.each([
  ['too short', btoa('short')],
  ['not base64', '!!!!'],
])('refuses a handoff key that is %s', async (_case, secret) => {
  await expect(importHandoffKey(secret)).resolves.toBeUndefined()
})
