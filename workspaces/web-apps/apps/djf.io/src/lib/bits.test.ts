import {expect, test} from 'vitest'
import {bitsByByte, type Uint8ArrayOfLength} from './bits'

const read = (bytes: Array<number>, mask?: Array<number>) =>
  bitsByByte({
    bigEndianBytes: Uint8Array.from(bytes),
    lsbBitMask: mask && Uint8Array.from(mask),
  }).map((bits) => bits.map((bit) => bit.value).join(''))

test('every byte value reads as its masked binary digits at every width', () => {
  for (let value = 0; value < 256; value += 1) {
    for (let width = 1; width <= 8; width += 1) {
      const mask = (1 << width) - 1
      const digits = (value & mask).toString(2).padStart(width, '0')
      expect(read([value], [mask])).toEqual([digits])
    }
  }
})

test.each([
  {
    name: 'a big-endian float32 (1.5) shows every bit without a mask',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    mask: undefined,
    expected: ['00111111', '11000000', '00000000', '00000000'],
  },
  {
    name: 'a 12-bit value shows only the masked low nibble of its first byte',
    bytes: [0xfa, 0xbc],
    mask: [0x0f, 0xff],
    expected: ['1010', '10111100'],
  },
])('$name', ({bytes, mask, expected}) => {
  expect(read(bytes, mask)).toEqual(expected)
})

test('positions count down to 0 at the least significant bit, across bytes', () => {
  const byteGroups = bitsByByte({
    bigEndianBytes: Uint8Array.of(0x0a, 0xbc),
    lsbBitMask: Uint8Array.of(0x0f, 0xff),
  })

  expect(byteGroups.map((bits) => bits.map((bit) => bit.position))).toEqual([
    [11, 10, 9, 8],
    [7, 6, 5, 4, 3, 2, 1, 0],
  ])
})

test.each([
  {
    name: 'a mask shorter than the bytes',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    mask: [0xff, 0xff],
    error: 'lsbBitMask has 2 bytes but bigEndianBytes has 4',
  },
  {
    name: 'a mask longer than the bytes',
    bytes: [0x3f],
    mask: [0x0f, 0xff],
    error: 'lsbBitMask has 2 bytes but bigEndianBytes has 1',
  },
  {name: 'no bytes', bytes: [], mask: undefined, error: 'got ""'},
  {name: 'a mask with no bits', bytes: [0xff], mask: [0x00], error: 'got "00000000"'},
  {name: 'a mask from the top down', bytes: [0xff], mask: [0xf0], error: 'got "11110000"'},
  {name: 'a mask with a gap', bytes: [0xff], mask: [0x0d], error: 'got "00001101"'},
  {
    name: 'a mask that skips whole leading bytes',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    mask: [0x00, 0x00, 0xff, 0xff],
    error: 'got "00000000 00000000 11111111 11111111"',
  },
])('rejects $name', ({bytes, mask, error}) => {
  expect(() => read(bytes, mask)).toThrow(error)
})

// Checked by `astro check`, not at runtime: without NoInfer on lsbBitMask, L
// would widen to 4 | 2 and this call would compile.
const mismatchedLengths = (
  bigEndianBytes: Uint8ArrayOfLength<4>,
  lsbBitMask: Uint8ArrayOfLength<2>,
) =>
  // @ts-expect-error -- lsbBitMask must be as long as bigEndianBytes
  bitsByByte({bigEndianBytes, lsbBitMask})

test('a mask of another literal length is a type error', () => {
  expect(mismatchedLengths).toBeTypeOf('function')
})
