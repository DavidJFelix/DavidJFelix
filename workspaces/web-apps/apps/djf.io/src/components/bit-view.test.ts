import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect, test} from 'vitest'
import {BitView} from './bit-view'

// Without a client directive the component ships as this static markup, so the
// server render is the whole contract.
const render = (bytes: Array<number>, bitLength?: number) =>
  renderToStaticMarkup(createElement(BitView, {bytes: Uint8Array.from(bytes), bitLength}))

// The text that copy/paste and the markdown rendition for agents see.
const textOf = (html: string) => html.replace(/<[^>]+>/g, '')

test.each([
  {
    name: 'a 16-bit value',
    bytes: [0x3f, 0xc0],
    bitLength: 16,
    text: '16 bits: 0 0 1 1 1 1 1 1, 1 1 0 0 0 0 0 0. 00111111 11000000',
  },
  {name: 'a 4-bit value', bytes: [0b1011], bitLength: 4, text: '4 bits: 1 0 1 1. 1011'},
  {name: 'a single bit', bytes: [0b1], bitLength: 1, text: '1 bit: 1. 1'},
])(
  'BitView renders $name as a screen reader summary, then digits grouped by byte',
  ({bytes, bitLength, text}) => {
    expect(textOf(render(bytes, bitLength))).toBe(text)
  },
)

test('BitView hides the cells of each byte from screen readers, which read the summary', () => {
  expect(render([0x3f, 0xc0], 16).match(/aria-hidden="true"/g)).toHaveLength(2)
})

test('BitView styles set and clear bits differently', () => {
  const [setClass, clearClass] = [
    ...render([0b10], 2).matchAll(/<span class="([^"]+)">[01]</g),
  ].map((match) => match[1])

  expect(setClass).not.toBe(clearClass)
})
