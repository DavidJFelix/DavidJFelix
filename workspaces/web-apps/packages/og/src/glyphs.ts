// The code points of the Inter `latin` subset that every runtime loads, in
// the form of the CSS `unicode-range` in `@fontsource/inter/unicode.json`.
// This module imports no font and no wasm, so page head code can call it.
export const INTER_LATIN_RANGES =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

interface CodePointRange {
  first: number
  last: number
}

const parseRange = (range: string): CodePointRange => {
  const [first = '', last = first] = range.replace('U+', '').split('-')
  return {first: Number.parseInt(first, 16), last: Number.parseInt(last, 16)}
}

const RANGES: readonly CodePointRange[] = INTER_LATIN_RANGES.split(',').map(parseRange)

const isDrawable = (codePoint: number): boolean =>
  RANGES.some(({first, last}) => codePoint >= first && codePoint <= last)

// True when the card font has a glyph for each character of the text. The
// card draws a box in place of a character that it cannot draw.
export function canDrawText(text: string): boolean {
  return Array.from(text).every((character) => isDrawable(character.codePointAt(0) ?? 0))
}
