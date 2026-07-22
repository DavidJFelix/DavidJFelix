import {expect, test} from 'vitest'
import {cn} from './utils'

test('cn merges class names into a single string', () => {
  expect(cn('a', 'b')).toBe('a b')
})

test('cn lets a later tailwind utility win on conflict', () => {
  expect(cn('px-2', 'px-4')).toBe('px-4')
})

test('cn skips falsy values', () => {
  expect(cn('a', false, null, undefined, 'b')).toBe('a b')
})
