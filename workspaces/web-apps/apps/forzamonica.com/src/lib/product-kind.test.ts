import {expect, test} from 'vitest'

import {kindTone, productKind} from './product-kind.ts'

test('recognizes the print and original product types', () => {
  expect(productKind('Print')).toBe('Print')
  expect(productKind('Original')).toBe('Original')
})

test('treats any other product type as having no kind', () => {
  expect(productKind('')).toBeNull()
  expect(productKind('Jacket')).toBeNull()
})

test('originals wear rose, prints wear sky', () => {
  expect(kindTone('Original')).toBe('rose')
  expect(kindTone('Print')).toBe('sky')
})
