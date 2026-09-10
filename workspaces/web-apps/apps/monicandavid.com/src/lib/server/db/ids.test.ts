import * as fc from 'fast-check'
import {expect, test} from 'vitest'
import {encodeCrockford32, newId, uuidV7} from './ids'

// cSpell:words authn
// cSpell:ignore HJKMNP -- a run of the Crockford alphabet inside the character class
const ID_PATTERN = /^(?<prefix>user|authn)_(?<uuid>[0-9A-HJKMNP-TV-Z]{26})$/u

const sixteenBytes = fc.uint8Array({minLength: 16, maxLength: 16})
const tenBytes = fc.uint8Array({minLength: 10, maxLength: 10})

// Byte strings compare the way the encoded ids must: lexicographically, most
// significant byte first.
function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const firstDifference = left.findIndex((byte, index) => byte !== right[index])
  return firstDifference === -1 ? 0 : (left[firstDifference] ?? 0) - (right[firstDifference] ?? 0)
}

// Code-unit order, the order a database or `Array.prototype.sort` applies to
// the ids; locale collation is deliberately not involved.
function compareStrings(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

test('sixteen zero bytes encode as twenty-six zeros', () => {
  // given
  const bytes = new Uint8Array(16)

  // when
  const encoded = encodeCrockford32(bytes)

  // then
  expect(encoded).toBe('00000000000000000000000000')
})

test('sixteen 0xff bytes fill every character, with the two spare bits leading', () => {
  // given
  const bytes = new Uint8Array(16).fill(0xff)

  // when
  const encoded = encodeCrockford32(bytes)

  // then
  expect(encoded).toBe('7ZZZZZZZZZZZZZZZZZZZZZZZZZ')
})

test('encoding preserves byte order, so ids sort as plain strings', () => {
  fc.assert(
    fc.property(sixteenBytes, sixteenBytes, (left, right) => {
      // when
      const encodedLeft = encodeCrockford32(left)
      const encodedRight = encodeCrockford32(right)

      // then
      expect(compareStrings(encodedLeft, encodedRight)).toBe(Math.sign(compareBytes(left, right)))
    }),
  )
})

test('a uuid v7 carries the timestamp, version, and variant in the RFC positions', () => {
  // given
  const timestampMs = 0x0192_3456_789a // 2024-10-01T09:56:07.322Z, fills all 48 bits
  const random = new Uint8Array(10).fill(0xff)

  // when
  const uuid = uuidV7({timestampMs, random})

  // then
  expect(Array.from(uuid.subarray(0, 6))).toEqual([0x01, 0x92, 0x34, 0x56, 0x78, 0x9a])
  expect((uuid[6] ?? 0) >> 4).toBe(0x7)
  expect((uuid[8] ?? 0) >> 6).toBe(0b10)
  expect(Array.from(uuid.subarray(9))).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
})

test('version and variant bits hold for every random input', () => {
  fc.assert(
    fc.property(fc.nat({max: 2 ** 48 - 1}), tenBytes, (timestampMs, random) => {
      // when
      const uuid = uuidV7({timestampMs, random})

      // then
      expect(uuid).toHaveLength(16)
      expect((uuid[6] ?? 0) & 0xf0).toBe(0x70)
      expect((uuid[8] ?? 0) & 0xc0).toBe(0x80)
    }),
  )
})

test.each([
  ['a user id', 'user'],
  ['an authentication id', 'authn'],
] as const)('%s is the prefix, an underscore, and 26 Crockford characters', (_, prefix) => {
  // when
  const id = newId({prefix})

  // then
  expect(id).toMatch(ID_PATTERN)
  expect(id.startsWith(`${prefix}_`)).toBe(true)
})

test('an id created later sorts after one created earlier', () => {
  // given
  const random = new Uint8Array(10).fill(0xff)
  const earlier = newId({prefix: 'user', timestampMs: 1_700_000_000_000, random})

  // when
  const later = newId({prefix: 'user', timestampMs: 1_700_000_000_001, random: new Uint8Array(10)})

  // then
  expect(earlier < later).toBe(true)
})

test('two ids minted in the same millisecond differ by their random bits', () => {
  // given
  const timestampMs = 1_700_000_000_000

  // when
  const first = newId({prefix: 'user', timestampMs})
  const second = newId({prefix: 'user', timestampMs})

  // then
  expect(first).not.toBe(second)
  expect(first.slice(0, 15)).toBe(second.slice(0, 15))
})
