import {expect, test} from 'vitest'

import {formatPrice} from './format-price.ts'

test('formats USD amounts with currency symbol', () => {
  expect(formatPrice({amount: '29.99', currencyCode: 'USD'})).toBe('$29.99')
})

test('drops the cents from whole-number amounts', () => {
  expect(formatPrice({amount: '120.0', currencyCode: 'USD'})).toBe('$120')
})

test('formats non-USD currencies', () => {
  expect(formatPrice({amount: '50.5', currencyCode: 'EUR'})).toBe('€50.50')
})
