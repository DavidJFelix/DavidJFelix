import {expect, test} from 'vitest'
import {fromDataUrl, interFonts} from './fonts'

test('interFonts declares regular and bold Inter over the bytes it is given', () => {
  const regular = new ArrayBuffer(4)
  const bold = new Uint8Array([1, 2, 3])
  const fonts = interFonts({regular, bold})
  expect(fonts.map((font) => [font.name, font.weight, font.style])).toEqual([
    ['Inter', 400, 'normal'],
    ['Inter', 700, 'normal'],
  ])
  expect(fonts[0]?.data).toBe(regular)
  expect(fonts[1]?.data).toBe(bold)
})

// The payload is the base64 for the bytes 0, 1, 2. cSpell:ignore AAEC
test('fromDataUrl decodes the base64 payload of a data URL', () => {
  expect(fromDataUrl('data:font/woff2;base64,AAEC')).toEqual(new Uint8Array([0, 1, 2]))
})
