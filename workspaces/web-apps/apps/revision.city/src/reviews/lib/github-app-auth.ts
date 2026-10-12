import {z} from 'zod'
import {createGitHubRequest} from './github-api'
import type {Fetch} from './openrouter'

export interface GitHubAppKey {
  clientId: string
  // The PEM private key that GitHub generates for the app (PKCS#1), or the
  // same key as PKCS#8.
  privateKey: string
}

export interface CreateAppJwtParams extends GitHubAppKey {
  nowSeconds: number
}

// GitHub refuses an app JWT that expires more than 10 minutes after it is made.
// GitHub advises an issue time 60 seconds in the past, for clock drift.
export async function createAppJwt({
  clientId,
  privateKey,
  nowSeconds,
}: CreateAppJwtParams): Promise<string> {
  const header = encodeBase64Url(JSON.stringify({alg: 'RS256', typ: 'JWT'}))
  const payload = encodeBase64Url(
    JSON.stringify({iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: clientId}),
  )
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    readPkcs8PrivateKey(privateKey),
    {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

const PEM_PATTERN = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/

// The DER encoding of the rsaEncryption AlgorithmIdentifier.
const RSA_ALGORITHM_IDENTIFIER = [
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
]

// WebCrypto cannot import a PKCS#1 key, so this function wraps it in a PKCS#8
// PrivateKeyInfo: SEQUENCE {INTEGER 0, AlgorithmIdentifier, OCTET STRING key}.
function readPkcs8PrivateKey(pem: string): Uint8Array<ArrayBuffer> {
  const match = PEM_PATTERN.exec(pem)
  if (!match) {
    throw new Error('The GitHub App private key is not in PEM format')
  }
  const [, label, body] = match
  const der = Uint8Array.from(atob(body.replaceAll(/\s/g, '')), (character) =>
    character.charCodeAt(0),
  )
  if (label === 'PRIVATE KEY') {
    return der
  }
  if (label !== 'RSA PRIVATE KEY') {
    throw new Error(`The GitHub App private key has an unsupported PEM label: ${label}`)
  }
  const privateKey = [0x04, ...derLength(der.length), ...der]
  const info = [0x02, 0x01, 0x00, ...RSA_ALGORITHM_IDENTIFIER, ...privateKey]
  return Uint8Array.from([0x30, ...derLength(info.length), ...info])
}

// An RSA private key is longer than 255 bytes and shorter than 64 KiB, so its
// DER lengths always use the two-byte long form.
function derLength(length: number): number[] {
  return [0x82, length >> 8, length & 0xff]
}

// The token gets only the permissions for a review: `checks` to create check
// runs, `pull_requests` to post reviews, and `contents` to read files.
const INSTALLATION_PERMISSIONS = {checks: 'write', contents: 'read', pull_requests: 'write'}

export interface CreateInstallationTokenSourceParams extends GitHubAppKey {
  installationId: number
  // The token can reach only this repository.
  repositoryId: number
  fetch?: Fetch
  now?: () => number
}

const installationTokenSchema = z.object({token: z.string(), expires_at: z.string()})

// Installation tokens last an hour. The token source does not return a token in
// the last 5 minutes before it expires, so that no token expires during a
// request.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

// Calls share one token and one request for it. After a failed request, the
// next call tries again.
export function createInstallationTokenSource({
  clientId,
  privateKey,
  installationId,
  repositoryId,
  fetch: fetchImpl,
  now = Date.now,
}: CreateInstallationTokenSourceParams): () => Promise<string> {
  const request = createGitHubRequest({
    token: () => createAppJwt({clientId, privateKey, nowSeconds: Math.floor(now() / 1000)}),
    fetch: fetchImpl,
  })
  let current: {token: string; expiresAtMs: number} | undefined
  let pending: Promise<string> | undefined
  return () => {
    if (current && current.expiresAtMs - now() > TOKEN_REFRESH_MARGIN_MS) {
      return Promise.resolve(current.token)
    }
    pending ??= request({
      method: 'POST',
      path: `/app/installations/${installationId}/access_tokens`,
      body: {repository_ids: [repositoryId], permissions: INSTALLATION_PERMISSIONS},
      schema: installationTokenSchema,
    })
      .then(({token, expires_at}) => {
        current = {token, expiresAtMs: Date.parse(expires_at)}
        return token
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }
}
