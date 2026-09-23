// Reads a PNG's dimensions from its fixed-layout header: an 8-byte signature,
// then the big-endian width at byte 16 and height at byte 20 -- enough for a
// test to assert the size the og:image:width/height meta advertises without
// an image library.
export interface PngSize {
  width: number
  height: number
}

export const pngSize = (png: Uint8Array): PngSize => {
  if (String.fromCharCode(...png.subarray(1, 4)) !== 'PNG') {
    throw new Error('Not a PNG: the signature bytes are missing')
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return {width: view.getUint32(16), height: view.getUint32(20)}
}
