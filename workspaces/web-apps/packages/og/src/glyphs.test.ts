import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {expect, test} from 'vitest'
import {canDrawText, INTER_LATIN_RANGES} from './glyphs'

// cSpell:ignore Привет

test.each([
  {name: 'plain Latin', text: 'fix: add widgets (#7)', drawable: true},
  {name: 'curly quotes, a dash and an ellipsis', text: '“Quoted” – and more…', drawable: true},
  {name: 'accented Western letters', text: 'Café déjà vu', drawable: true},
  {name: 'an empty text', text: '', drawable: true},
  {name: 'a Polish letter', text: 'Ł', drawable: false},
  {name: 'Cyrillic', text: 'Привет', drawable: false},
  {name: 'CJK', text: '修复', drawable: false},
  {name: 'a right arrow', text: 'a → b', drawable: false},
  {name: 'an emoji', text: '🚀 launch', drawable: false},
])('canDrawText is $drawable for $name', ({text, drawable}) => {
  expect(canDrawText(text)).toBe(drawable)
})

// The font package does not export unicode.json, so the test reads it from
// disk beside the package's own package.json.
test('the ranges are the latin subset of the installed Inter package', async () => {
  const manifest = createRequire(import.meta.url).resolve('@fontsource/inter/package.json')
  const subsets: Record<string, string> = JSON.parse(
    await readFile(join(dirname(manifest), 'unicode.json'), 'utf8'),
  )
  expect(INTER_LATIN_RANGES).toBe(subsets.latin)
})
