// Session tokens: a JWT the server signs with HS256 over a shared secret and
// hands the browser as a cookie. Three claims and nothing else -- `sub` is the
// user id, `iat` when the token was issued, `exp` when it stops being honored.
// The user row is the source of truth for everything else, so nothing about
// the person is copied into the token.
//
// Verification is what /admin gates on (src/hooks.server.ts): the signature
// must match the secret, the issued-at time must have passed, and the expiry
// must not have. Both functions take the clock and the secret as arguments so
// tests pin them; the hook passes the real ones.

import {errors, jwtVerify, SignJWT} from 'jose'

export const SESSION_COOKIE = 'session'

const ALGORITHM = 'HS256'
const CLAIMS = ['sub', 'iat', 'exp']

export interface SignSessionParams {
  userId: string
  secret: string
  issuedAt: Date
  expiresAt: Date
}

export async function signSession({
  userId,
  secret,
  issuedAt,
  expiresAt,
}: SignSessionParams): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({alg: ALGORITHM, typ: 'JWT'})
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secretKey(secret))
}

export type SessionRejection = 'malformed' | 'bad-signature' | 'not-yet-issued' | 'expired'

export type SessionVerification = {ok: true; userId: string} | {ok: false; reason: SessionRejection}

export interface VerifySessionParams {
  token: string
  secret: string
  now: Date
}

export async function verifySession({
  token,
  secret,
  now,
}: VerifySessionParams): Promise<SessionVerification> {
  try {
    const {payload} = await jwtVerify(token, secretKey(secret), {
      algorithms: [ALGORITHM],
      requiredClaims: CLAIMS,
      currentDate: now,
    })
    // jose enforces that the required claims are present and that `iat` is a
    // number, but takes any JSON value as a subject; a user id is a string.
    const {sub, iat} = payload
    if (typeof sub !== 'string' || iat === undefined) {
      return {ok: false, reason: 'malformed'}
    }
    // jose checks `exp` and `nbf` against the clock but reads `iat` only for
    // max-age purposes; a token dated in the future is rejected here.
    if (iat > Math.floor(now.getTime() / 1000)) {
      return {ok: false, reason: 'not-yet-issued'}
    }
    return {ok: true, userId: sub}
  } catch (cause) {
    return {ok: false, reason: rejectionOf(cause)}
  }
}

function rejectionOf(cause: unknown): SessionRejection {
  if (cause instanceof errors.JWTExpired) return 'expired'
  if (cause instanceof errors.JWSSignatureVerificationFailed) return 'bad-signature'
  return 'malformed'
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}
