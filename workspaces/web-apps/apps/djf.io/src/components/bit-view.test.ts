import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect, test} from 'vitest'
import {uint8ArrayOf} from '../lib/bits'
import {BitView} from './bit-view'

// Without a client directive the component ships as this static markup, so the
// server render is the whole contract.
const render = (bytes: Array<number>, mask?: number) =>
  renderToStaticMarkup(
    createElement(BitView, {
      bigEndianBytes: Uint8Array.from(bytes),
      leastSignificantByteMask: mask === undefined ? undefined : uint8ArrayOf(mask),
    }),
  )

// The text that copy/paste and the markdown rendition for agents see.
const textOf = (html: string) => html.replace(/<[^>]+>/g, '')

test.each([
  {
    name: 'a 16-bit value',
    bytes: [0x3f, 0xc0],
    mask: undefined,
    text: '16 bits: 0 0 1 1 1 1 1 1, 1 1 0 0 0 0 0 0. 00111111 11000000',
  },
  {name: 'a 4-bit value', bytes: [0b10110000], mask: 0xf0, text: '4 bits: 1 0 1 1. 1011'},
  {name: 'a single bit', bytes: [0b10000000], mask: 0x80, text: '1 bit: 1. 1'},
])(
  'BitView renders $name as a screen reader summary, then digits grouped by byte',
  ({bytes, mask, text}) => {
    expect(textOf(render(bytes, mask))).toBe(text)
  },
)

test('BitView hides the cells of each byte from screen readers, which read the summary', () => {
  expect(render([0x3f, 0xc0]).match(/aria-hidden="true"/g)).toHaveLength(2)
})

test('BitView styles set and clear bits differently', () => {
  const [setClass, clearClass] = [
    ...render([0b10000000], 0xc0).matchAll(/<span class="([^"]+)">[01]</g),
  ].map((match) => match[1])

  expect(setClass).not.toBe(clearClass)
})
