import {expect, test} from 'vitest'
import {fromDataUrl, interFonts} from './fonts'

test('interFonts declares regular and bold Inter over ArrayBuffer data', () => {
  const regular = new ArrayBuffer(4)
  const fonts = interFonts({regular, bold: new Uint8Array([1, 2, 3])})
  expect(fonts.map((font) => [font.name, font.weight, font.style])).toEqual([
    ['Inter', 400, 'normal'],
    ['Inter', 700, 'normal'],
  ])
  expect(fonts[0]?.data).toBe(regular)
  expect(new Uint8Array(fonts[1]?.data ?? [])).toEqual(new Uint8Array([1, 2, 3]))
})

test('interFonts copies a view so its offset does not leak into the font data', () => {
  const framed = new Uint8Array([9, 9, 1, 2, 3])
  const [font] = interFonts({regular: framed.subarray(2), bold: framed.subarray(2)})
  expect(new Uint8Array(font?.data ?? [])).toEqual(new Uint8Array([1, 2, 3]))
})

// The payload is the base64 for the bytes 0, 1, 2. cSpell:ignore AAEC
test('fromDataUrl decodes the base64 payload of a data URL', () => {
  expect(fromDataUrl('data:font/woff;base64,AAEC')).toEqual(new Uint8Array([0, 1, 2]))
})
