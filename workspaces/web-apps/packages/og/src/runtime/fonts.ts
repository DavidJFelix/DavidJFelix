// Latin Inter at the two weights that the card uses. Takumi reads WOFF2 but
// not the older WOFF. Every runtime loads the same two .woff2 files from the
// installed @fontsource package, and only the way it loads them differs.
import type {FontDetails} from '@takumi-rs/wasm'

export interface InterFontsParams {
  regular: ArrayBuffer | Uint8Array
  bold: ArrayBuffer | Uint8Array
}

// Takumi copies only the bytes that a view covers, so a view with an offset
// goes in as it is.
export const interFonts = ({regular, bold}: InterFontsParams): Array<FontDetails> => [
  {name: 'Inter', data: regular, weight: 400, style: 'normal'},
  {name: 'Inter', data: bold, weight: 700, style: 'normal'},
]

// Decodes a bundler-inlined asset ('data:font/woff2;base64,...') to bytes.
export const fromDataUrl = (dataUrl: string): Uint8Array => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
