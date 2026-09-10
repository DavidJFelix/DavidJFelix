import {CompactSign, decodeJwt, SignJWT, UnsecuredJWT} from 'jose'
import {expect, test} from 'vitest'
import {signSession, verifySession} from './session'

// A fixed clock keeps every boundary exact: tokens are minted relative to
// `now`, then verified at `now`.
const now = new Date('2026-09-10T12:00:00Z')
const secret = 'correct-horse-battery-staple-correct-horse-battery-staple'
const otherSecret = 'wrong-horse-battery-staple-wrong-horse-battery-staple-xx'
const userId = 'user_01K4R3ZJ3M9EFB7GX0Q2T5V8WA' // cSpell:ignore 01K4R3ZJ3M9EFB7GX0Q2T5V8WA

function secondsFromNow(seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000)
}

// A token the server would issue: dated a minute ago, good for an hour.
function freshToken(overrides: {secret?: string; issuedAt?: Date; expiresAt?: Date} = {}) {
  return signSession({
    userId,
    secret: overrides.secret ?? secret,
    issuedAt: overrides.issuedAt ?? secondsFromNow(-60),
    expiresAt: overrides.expiresAt ?? secondsFromNow(3600),
  })
}

test('a token signed with the shared secret, issued in the past, and not yet expired is accepted', async () => {
  // given
  const token = await freshToken()

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: true, userId})
})

test('the token carries exactly the subject, issued-at, and expiry claims', async () => {
  // given
  const issuedAt = secondsFromNow(-60)
  const expiresAt = secondsFromNow(3600)

  // when
  const token = await signSession({userId, secret, issuedAt, expiresAt})

  // then
  expect(decodeJwt(token)).toEqual({
    sub: userId,
    iat: Math.floor(issuedAt.getTime() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  })
})

test('a token issued this very second is accepted', async () => {
  // given
  const token = await freshToken({issuedAt: now})

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: true, userId})
})

test('a token signed with a different secret is rejected', async () => {
  // given
  const token = await freshToken({secret: otherSecret})

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'bad-signature'})
})

test('a token whose claims were edited after signing is rejected', async () => {
  // given
  const token = await freshToken()
  const [header, , signature] = token.split('.')
  const forgedPayload = Buffer.from(
    JSON.stringify({...decodeJwt(token), sub: 'user_00000000000000000000000000'}),
  ).toString('base64url')
  const forged = `${header}.${forgedPayload}.${signature}`

  // when
  const verification = await verifySession({token: forged, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'bad-signature'})
})

test('a token past its expiry is rejected', async () => {
  // given
  const token = await freshToken({expiresAt: secondsFromNow(-1)})

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'expired'})
})

test('a token expiring this very second is already rejected', async () => {
  // given
  const token = await freshToken({expiresAt: now})

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'expired'})
})

test('a token dated in the future is rejected', async () => {
  // given
  const token = await freshToken({issuedAt: secondsFromNow(1)})

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'not-yet-issued'})
})

// Tokens that are not what the server issues, whatever their signature says.
test.each([
  ['not a JWT at all', () => Promise.resolve('definitely-not-a-token')],
  ['an empty string', () => Promise.resolve('')],
  [
    'an unsigned token',
    () =>
      Promise.resolve(
        new UnsecuredJWT({})
          .setSubject(userId)
          .setIssuedAt(secondsFromNow(-60))
          .setExpirationTime(secondsFromNow(3600))
          .encode(),
      ),
  ],
  [
    'a token signed with a different algorithm',
    () =>
      new SignJWT({})
        .setProtectedHeader({alg: 'HS512'})
        .setSubject(userId)
        .setIssuedAt(secondsFromNow(-60))
        .setExpirationTime(secondsFromNow(3600))
        .sign(new TextEncoder().encode(secret)),
  ],
  [
    'a token with no expiry',
    () =>
      new SignJWT({})
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(userId)
        .setIssuedAt(secondsFromNow(-60))
        .sign(new TextEncoder().encode(secret)),
  ],
  [
    'a token with no issued-at',
    () =>
      new SignJWT({})
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(userId)
        .setExpirationTime(secondsFromNow(3600))
        .sign(new TextEncoder().encode(secret)),
  ],
  [
    'a token with no subject',
    () =>
      new SignJWT({})
        .setProtectedHeader({alg: 'HS256'})
        .setIssuedAt(secondsFromNow(-60))
        .setExpirationTime(secondsFromNow(3600))
        .sign(new TextEncoder().encode(secret)),
  ],
  [
    // Signed as a raw JWS: SignJWT's types will not let a subject be a number.
    'a token whose subject is not a string',
    () =>
      new CompactSign(
        new TextEncoder().encode(
          JSON.stringify({
            sub: 42,
            iat: Math.floor(secondsFromNow(-60).getTime() / 1000),
            exp: Math.floor(secondsFromNow(3600).getTime() / 1000),
          }),
        ),
      )
        .setProtectedHeader({alg: 'HS256'})
        .sign(new TextEncoder().encode(secret)),
  ],
])('%s is rejected as malformed', async (_, mint) => {
  // given
  const token = await mint()

  // when
  const verification = await verifySession({token, secret, now})

  // then
  expect(verification).toEqual({ok: false, reason: 'malformed'})
})
