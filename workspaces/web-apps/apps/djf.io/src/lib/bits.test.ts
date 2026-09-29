import {expect, test} from 'vitest'
import {bitsByByte} from './bits'

const read = (bytes: Array<number>, bitLength?: number) =>
  bitsByByte({bytes: Uint8Array.from(bytes), bitLength}).map((bits) =>
    bits.map((bit) => bit.value).join(''),
  )

test('every byte value reads as its binary digits at every width it fits in', () => {
  for (let value = 0; value < 256; value += 1) {
    const digits = value.toString(2)
    for (let bitLength = digits.length; bitLength <= 8; bitLength += 1) {
      expect(read([value], bitLength)).toEqual([digits.padStart(bitLength, '0')])
    }
  }
})

test.each([
  {
    name: 'a big-endian float32 (1.5) reads all four bytes by default',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    bitLength: undefined,
    expected: ['00111111', '11000000', '00000000', '00000000'],
  },
  {
    name: 'a 16-bit value reads two full bytes',
    bytes: [0x3f, 0xc0],
    bitLength: 16,
    expected: ['00111111', '11000000'],
  },
  {
    name: 'a 12-bit value leaves the top 4 bits of the first byte unused',
    bytes: [0x0a, 0xbc],
    bitLength: 12,
    expected: ['1010', '10111100'],
  },
])('$name', ({bytes, bitLength, expected}) => {
  expect(read(bytes, bitLength)).toEqual(expected)
})

test('positions count down to 0 at the least significant bit, across bytes', () => {
  const byteGroups = bitsByByte({bytes: Uint8Array.of(0x0a, 0xbc), bitLength: 12})

  expect(byteGroups.map((bits) => bits.map((bit) => bit.position))).toEqual([
    [11, 10, 9, 8],
    [7, 6, 5, 4, 3, 2, 1, 0],
  ])
})

test.each([
  {name: 'no bytes', bytes: [], bitLength: undefined, error: 'whole number above 0, got 0'},
  {name: 'a fractional width', bytes: [0x0b], bitLength: 4.5, error: 'got 4.5'},
  {
    name: 'more bytes than the width needs',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    bitLength: 16,
    error: '16 bits take 2 bytes, got 4',
  },
  {name: 'fewer bytes than the width needs', bytes: [0xff], bitLength: 9, error: 'got 1'},
  {name: 'set bits above the width', bytes: [0xf3], bitLength: 4, error: '0b11110011'},
])('rejects $name', ({bytes, bitLength, error}) => {
  expect(() => read(bytes, bitLength)).toThrow(error)
})
