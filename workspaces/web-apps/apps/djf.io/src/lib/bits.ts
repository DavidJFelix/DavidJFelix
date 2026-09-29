// Reads the bits stored in a byte array for display: most significant bit
// first, grouped by the byte each bit lives in. Knows nothing about number
// formats; callers encode a value (float, int, packed quantized weights) into
// bytes first.

export type Bit = 0 | 1

export interface PositionedBit {
  value: Bit
  // Place in the whole value, counted from the least significant bit (0).
  position: number
}

export interface BitsByByteParams {
  // Big-endian: bytes[0] holds the most significant bits.
  bytes: Uint8Array
  // The value's width in bits; defaults to every bit in bytes. A width that is
  // not a multiple of 8 right-aligns the value, so the top bits of bytes[0]
  // are unused and must be 0: Uint8Array.of(0b1011) at 4 bits reads 1011.
  bitLength?: number
}

export function bitsByByte({
  bytes,
  bitLength = bytes.length * 8,
}: BitsByByteParams): Array<Array<PositionedBit>> {
  if (!Number.isInteger(bitLength) || bitLength < 1) {
    throw new RangeError(`bitLength must be a whole number above 0, got ${bitLength}`)
  }
  const byteLength = Math.ceil(bitLength / 8)
  if (bytes.length !== byteLength) {
    throw new RangeError(`${bitLength} bits take ${byteLength} bytes, got ${bytes.length}`)
  }
  const unused = byteLength * 8 - bitLength
  if (bytes[0] >> (8 - unused) !== 0) {
    const first = bytes[0].toString(2).padStart(8, '0')
    throw new RangeError(
      `a ${bitLength}-bit value leaves the top ${unused} bits of bytes[0] unused, but bytes[0] is 0b${first}`,
    )
  }
  return Array.from(bytes, (byte, byteIndex) => {
    const count = byteIndex === 0 ? 8 - unused : 8
    // Position of this byte's least significant bit within the value.
    const base = (byteLength - 1 - byteIndex) * 8
    return Array.from({length: count}, (_, index): PositionedBit => {
      const shift = count - 1 - index
      return {value: ((byte >> shift) & 1) === 1 ? 1 : 0, position: base + shift}
    })
  })
}
