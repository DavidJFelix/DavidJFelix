// Latin Inter at the two weights the card uses. Satori needs raw font data
// (woff/ttf, not woff2), so every runtime loads the same two files from the
// installed @fontsource package; only the loading mechanism differs.
import type {Font} from 'satori/standalone'

export interface InterFontsParams {
  regular: ArrayBuffer | Uint8Array
  bold: ArrayBuffer | Uint8Array
}

// Satori wants an ArrayBuffer; a copy also drops any view offset a Node
// Buffer or a bundler's decoded bytes may carry.
const toArrayBuffer = (data: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (data instanceof ArrayBuffer) return data
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}

export const interFonts = ({regular, bold}: InterFontsParams): Array<Font> => [
  {name: 'Inter', data: toArrayBuffer(regular), weight: 400, style: 'normal'},
  {name: 'Inter', data: toArrayBuffer(bold), weight: 700, style: 'normal'},
]

// Decodes a bundler-inlined asset ('data:font/woff;base64,...') to bytes.
export const fromDataUrl = (dataUrl: string): Uint8Array => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
