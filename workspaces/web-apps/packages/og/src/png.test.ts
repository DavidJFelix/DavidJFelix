import {expect, test} from 'vitest'
import {pngSize} from './png'

// A PNG header by hand: the signature, then the width and height fields at
// the offsets the reader relies on.
const header = ({width, height}: {width: number; height: number}): Uint8Array => {
  const png = new Uint8Array(24)
  png.set([0x89, 0x50, 0x4e, 0x47])
  const view = new DataView(png.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return png
}

test('pngSize reads the width and height from the header', () => {
  expect(pngSize(header({width: 1200, height: 630}))).toEqual({width: 1200, height: 630})
})

test('pngSize honors a view offset into a larger buffer', () => {
  const framed = new Uint8Array(32)
  framed.set(header({width: 16, height: 9}), 8)
  expect(pngSize(framed.subarray(8))).toEqual({width: 16, height: 9})
})

test('pngSize rejects bytes without the PNG signature', () => {
  expect(() => pngSize(new Uint8Array(24))).toThrow('Not a PNG')
})
