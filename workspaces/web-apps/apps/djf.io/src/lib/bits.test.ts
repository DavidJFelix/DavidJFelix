import {expect, test} from 'vitest'
import {bitsByByte, byteToBinaryString, uint8ArrayOfLengthOf} from './bits'

const read = (bytes: Array<number>, mask?: number) =>
  bitsByByte({
    bigEndianBytes: Uint8Array.from(bytes),
    leastSignificantByteMask: mask === undefined ? undefined : uint8ArrayOfLengthOf(mask),
  }).map((bits) => bits.map((bit) => bit.value).join(''))

const EVERY_BYTE_VALUE = Array.from({length: 256}, (_, value) => value)

const EVERY_MASK_WIDTH = Array.from({length: 8}, (_, index) => index + 1)

const EIGHT_BINARY_DIGITS = /^[01]{8}$/

test.each([
  {byte: 0x00, binary: '00000000'},
  {byte: 0x01, binary: '00000001'},
  {byte: 0x3f, binary: '00111111'},
  {byte: 0xf0, binary: '11110000'},
  {byte: 0xff, binary: '11111111'},
])('byteToBinaryString($byte) is $binary', ({byte, binary}) => {
  expect(byteToBinaryString(byte)).toBe(binary)
})

test.each(EVERY_BYTE_VALUE)('byte %i is 8 binary digits that read back as itself', (byte) => {
  const binary = byteToBinaryString(byte)

  expect(binary).toMatch(EIGHT_BINARY_DIGITS)
  expect(Number.parseInt(binary, 2)).toBe(byte)
})

test.each(
  EVERY_BYTE_VALUE.flatMap((value) =>
    EVERY_MASK_WIDTH.map((width) => ({
      value,
      width,
      mask: (0xff << (8 - width)) & 0xff,
      digits: (value >> (8 - width)).toString(2).padStart(width, '0'),
    })),
  ),
)('byte $value shows its top $width bits as $digits', ({value, mask, digits}) => {
  expect(read([value], mask)).toEqual([digits])
})

test.each([
  {
    name: 'a big-endian float32 (1.5) shows every bit without a mask',
    bytes: [0x3f, 0xc0, 0x00, 0x00],
    mask: undefined,
    expected: ['00111111', '11000000', '00000000', '00000000'],
  },
  {
    name: 'a 12-bit value keeps its first byte whole and masks only the last',
    bytes: [0xab, 0xcf],
    mask: 0xf0,
    expected: ['10101011', '1100'],
  },
])('$name', ({bytes, mask, expected}) => {
  expect(read(bytes, mask)).toEqual(expected)
})

test('positions count down to 0 at the lowest masked bit of the last byte', () => {
  const byteGroups = bitsByByte({
    bigEndianBytes: Uint8Array.of(0xab, 0xe0),
    leastSignificantByteMask: uint8ArrayOfLengthOf(0xe0),
  })

  expect(byteGroups.map((bits) => bits.map((bit) => bit.position))).toEqual([
    [10, 9, 8, 7, 6, 5, 4, 3],
    [2, 1, 0],
  ])
})

test.each([
  {name: 'no bytes', bytes: [], mask: undefined, error: 'bigEndianBytes is empty'},
  {name: 'a mask with no bits', bytes: [0xff], mask: 0x00, error: 'got "00000000"'},
  {name: 'a mask of the low bits', bytes: [0xff], mask: 0x0f, error: 'got "00001111"'},
  {name: 'a mask with a gap', bytes: [0xff], mask: 0xd0, error: 'got "11010000"'},
])('rejects $name', ({bytes, mask, error}) => {
  expect(() => read(bytes, mask)).toThrow(error)
})

test('rejects a mask longer than one byte, which untyped MDX can still pass', () => {
  const twoByteMask = uint8ArrayOfLengthOf(0xff, 0x00)

  expect(() =>
    // @ts-expect-error -- the type allows only one byte; MDX is not type-checked
    bitsByByte({bigEndianBytes: Uint8Array.of(0xff), leastSignificantByteMask: twoByteMask}),
  ).toThrow('got "11111111 00000000"')
})
