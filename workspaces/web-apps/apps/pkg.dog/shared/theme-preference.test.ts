import {expect, test} from 'vitest'
import {parseThemePreference} from './theme-preference'

test.each([
  ['light', 'light'],
  ['dark', 'dark'],
  ['system', 'system'],
  [null, 'system'],
  ['', 'system'],
  ['sepia', 'system'],
] as const)('parseThemePreference(%j) -> %s', (value, expected) => {
  expect(parseThemePreference(value)).toBe(expected)
})
