// HTTP Basic auth gate for the deployed viewer. Alchemy state describes live
// infrastructure, so the app refuses to serve without either APP_PASSWORD or
// an explicit opt-out (local dev leaves APP_PASSWORD unset).

export interface BasicCredentials {
  user: string
  pass: string
}

/** Parse an `Authorization: Basic ...` header; undefined when absent/malformed. */
export const parseBasicAuth = (header: string | null): BasicCredentials | undefined => {
  if (header === null) return undefined
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/u.exec(header.trim())
  if (!match) return undefined
  let decoded: string
  try {
    decoded = atob(match[1] as string)
  } catch {
    return undefined
  }
  const separator = decoded.indexOf(':')
  if (separator === -1) return undefined
  return {user: decoded.slice(0, separator), pass: decoded.slice(separator + 1)}
}

/**
 * Compare a supplied password against the expected one without leaking length
 * or prefix timing: both sides are hashed with SHA-256 and the digests are
 * compared in full.
 */
export const verifyPassword = async (supplied: string, expected: string): Promise<boolean> => {
  const encoder = new TextEncoder()
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(suppliedDigest)
  const b = new Uint8Array(expectedDigest)
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] as number) ^ (b[i] as number)
  }
  return diff === 0
}

export const unauthorizedResponse = (): Response =>
  new Response('Unauthorized', {
    status: 401,
    headers: {
      'www-authenticate': 'Basic realm="alchemy-state-viewer", charset="UTF-8"',
    },
  })
