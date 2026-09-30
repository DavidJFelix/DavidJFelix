// Reads the bits stored in a byte array for display: most significant bit
// first, grouped by the byte each bit lives in. Knows nothing about number
// formats; callers encode a value (float, int, packed quantized weights) into
// bytes first.

export type Bit = 0 | 1

// A Uint8Array with its length in the type. MDX is not type-checked, so
// bitsByByte checks lengths at runtime too.
export type Uint8ArrayOfLength<L extends number> = Uint8Array & {readonly length: L}

// Uint8Array.of with the byte count in the type: uint8ArrayOf(0xf0) is a
// Uint8ArrayOfLength<1>.
export function uint8ArrayOf<const T extends ReadonlyArray<number>>(
  ...bytes: T
): Uint8ArrayOfLength<T['length']>
export function uint8ArrayOf(...bytes: ReadonlyArray<number>): Uint8Array {
  return Uint8Array.from(bytes)
}

export interface PositionedBit {
  value: Bit
  // Place in the whole value, counted from its least significant bit (0).
  position: number
}

export interface BitsByByteParams {
  bigEndianBytes: Uint8Array
  // Which bits of the last (least significant) byte belong to the value: ones
  // from the top, zeros from the least significant bit up (0b11110000 keeps
  // the top 4 bits). Every earlier byte is whole. Defaults to 0b11111111.
  leastSignificantByteMask?: Uint8ArrayOfLength<1>
}

const SHIFTS_MSB_FIRST = [7, 6, 5, 4, 3, 2, 1, 0]

const bitAt = (byte: number, shift: number): Bit => (((byte >> shift) & 1) === 1 ? 1 : 0)

export function bitsByByte({
  bigEndianBytes,
  leastSignificantByteMask = uint8ArrayOf(0xff),
}: BitsByByteParams): Array<Array<PositionedBit>> {
  if (bigEndianBytes.length === 0) {
    throw new RangeError('bigEndianBytes is empty')
  }
  const maskBytes = Array.from(leastSignificantByteMask, (byte) =>
    byte.toString(2).padStart(8, '0'),
  )
  if (maskBytes.length !== 1 || !/^1+0*$/.test(maskBytes[0])) {
    throw new RangeError(
      `leastSignificantByteMask must be one byte of ones then zeros (like 11110000), got "${maskBytes.join(' ')}"`,
    )
  }
  const lastByte = bigEndianBytes.length - 1
  const lastMask = leastSignificantByteMask[0]
  // The mask's clear bits are the bottom of the last byte, below the value.
  const unused = SHIFTS_MSB_FIRST.filter((shift) => bitAt(lastMask, shift) === 0).length
  return Array.from(bigEndianBytes, (byte, byteIndex) => {
    const mask = byteIndex === lastByte ? lastMask : 0xff
    return SHIFTS_MSB_FIRST.filter((shift) => bitAt(mask, shift) === 1).map(
      (shift): PositionedBit => ({
        value: bitAt(byte, shift),
        position: (lastByte - byteIndex) * 8 + shift - unused,
      }),
    )
  })
}
