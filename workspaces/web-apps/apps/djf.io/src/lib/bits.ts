// Reads the bits stored in a byte array for display: most significant bit
// first, grouped by the byte each bit lives in. Knows nothing about number
// formats; callers encode a value (float, int, packed quantized weights) into
// bytes first.

export type Bit = 0 | 1

// A Uint8Array with its length in the type, so two arrays can be required to
// match. That only bites for literal lengths (Uint8Array.of returns length:
// number, and MDX is not type-checked), so bitsByByte also checks at runtime.
export type Uint8ArrayOfLength<L extends number> = Uint8Array & {readonly length: L}

export interface PositionedBit {
  value: Bit
  // Place in the whole value, counted from the least significant bit (0).
  position: number
}

export interface BitsByByteParams<L extends number> {
  bigEndianBytes: Uint8ArrayOfLength<L>
  // The value's bits, byte for byte with bigEndianBytes: ones from the least
  // significant bit up, starting in the first byte (Uint8Array.of(0x0f) for a
  // 4-bit value). Defaults to every bit. NoInfer keeps L from widening to fit
  // a mask of the wrong length.
  lsbBitMask?: Uint8ArrayOfLength<NoInfer<L>>
}

const SHIFTS_MSB_FIRST = [7, 6, 5, 4, 3, 2, 1, 0]

const bitAt = (byte: number, shift: number): Bit => (((byte >> shift) & 1) === 1 ? 1 : 0)

export function bitsByByte<L extends number>({
  bigEndianBytes,
  lsbBitMask,
}: BitsByByteParams<L>): Array<Array<PositionedBit>> {
  const mask: Uint8Array = lsbBitMask ?? bigEndianBytes.map(() => 0xff)
  if (mask.length !== bigEndianBytes.length) {
    throw new RangeError(
      `lsbBitMask has ${mask.length} bytes but bigEndianBytes has ${bigEndianBytes.length}`,
    )
  }
  const maskBytes = Array.from(mask, (byte) => byte.toString(2).padStart(8, '0'))
  // At most 7 leading zeros: every byte passed holds at least one bit of the
  // value, so a figure can't silently show the low half of a wider value.
  if (!/^0{0,7}1+$/.test(maskBytes.join(''))) {
    throw new RangeError(
      `lsbBitMask must be ones from the least significant bit up, starting in the first byte (like 00001111 11111111), got "${maskBytes.join(' ')}"`,
    )
  }
  return Array.from(bigEndianBytes, (byte, byteIndex) => {
    // Position of this byte's least significant bit within the value.
    const base = (bigEndianBytes.length - 1 - byteIndex) * 8
    return SHIFTS_MSB_FIRST.filter((shift) => bitAt(mask[byteIndex], shift) === 1).map(
      (shift): PositionedBit => ({value: bitAt(byte, shift), position: base + shift}),
    )
  })
}
