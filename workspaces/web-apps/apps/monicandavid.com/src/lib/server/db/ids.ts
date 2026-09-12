// Row ids: a type prefix, an underscore, and a UUID v7 written as 26 characters
// of Crockford base32 (`user_` followed by the encoded uuid). The prefix makes
// an id self-describing wherever it turns up (logs, URLs, a foreign key
// column), and the v7 layout puts the millisecond timestamp in the high bits,
// so ids created later sort later as plain strings -- base32 preserves byte
// order, and 128 bits fit in 26 characters with no padding to strip.

// The prefixes are the enum of id-bearing tables; the schema pins each table
// to one of them. `authn` is the row id prefix for authentications.
// cSpell:words authn
export type IdPrefix = 'user' | 'authn'

// Crockford's alphabet drops I, L, O, and U so a hand-copied id can't be
// misread; it is upper-case, which keeps the ids case-stable in URLs.
// cSpell:ignore ABCDEFGHJKMNPQRSTVWXYZ -- the alphabet itself, not a word
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const RANDOM_BYTES = 10
const TIMESTAMP_BYTES = 6

// Big-endian base32 of a byte string: the bytes are read as one integer and
// emitted five bits at a time, most significant first. Sixteen bytes take 26
// characters (130 bits), so the leading character carries two zero bits -- the
// same layout ULIDs use.
export function encodeCrockford32(bytes: Uint8Array): string {
  const length = Math.ceil((bytes.length * 8) / 5)
  const value = bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)
  return Array.from({length}, (_, index) => {
    const shift = BigInt(5 * (length - 1 - index))
    return CROCKFORD_ALPHABET[Number((value >> shift) & 31n)]
  }).join('')
}

export interface UuidV7Params {
  /** Unix time in milliseconds; occupies the first 48 bits. */
  timestampMs: number
  /** Ten bytes of entropy for the 74 random bits (version and variant overwrite 6). */
  random: Uint8Array
}

// RFC 9562 UUID v7: 48-bit unix millisecond timestamp, the version nibble
// (0b0111) in byte 6, the RFC variant (0b10) in byte 8, random everywhere else.
export function uuidV7({timestampMs, random}: UuidV7Params): Uint8Array {
  const bytes = new Uint8Array(16)
  const timestamp = BigInt(timestampMs)
  for (let index = 0; index < TIMESTAMP_BYTES; index++) {
    const shift = BigInt(8 * (TIMESTAMP_BYTES - 1 - index))
    bytes[index] = Number((timestamp >> shift) & 0xffn)
  }
  bytes.set(random.subarray(0, RANDOM_BYTES), TIMESTAMP_BYTES)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  return bytes
}

export interface NewIdParams {
  prefix: IdPrefix
  /** Defaults to the current time; injectable so tests can pin the ordering. */
  timestampMs?: number
  /** Defaults to fresh cryptographically random bytes; injectable so tests are reproducible. */
  random?: Uint8Array
}

export function newId({
  prefix,
  timestampMs = Date.now(),
  random = crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)),
}: NewIdParams): string {
  return `${prefix}_${encodeCrockford32(uuidV7({timestampMs, random}))}`
}
