import {expect, test} from 'vitest'
import {NEXT_THEME_MODE, THEME_MODES, type ThemeMode, themeModeSchema} from './schema'

test('parses the three contract modes verbatim', () => {
  for (const mode of THEME_MODES) {
    expect(themeModeSchema.parse(mode)).toBe(mode)
  }
})

test('anything outside the contract parses to system', () => {
  // A missing dataset entry is the toggle binding's real absent-value shape.
  const {missing} = document.documentElement.dataset
  expect(themeModeSchema.parse(null)).toBe('system')
  expect(themeModeSchema.parse(missing)).toBe('system')
  expect(themeModeSchema.parse('blue')).toBe('system')
  expect(themeModeSchema.parse('')).toBe('system')
})

test('the cycle order visits every mode before repeating', () => {
  const visited = new Set<ThemeMode>()
  let mode: ThemeMode = 'system'
  for (let press = 0; press < THEME_MODES.length; press += 1) {
    mode = NEXT_THEME_MODE[mode]
    visited.add(mode)
  }
  expect(visited.size).toBe(THEME_MODES.length)
  expect(mode).toBe('system')
})
