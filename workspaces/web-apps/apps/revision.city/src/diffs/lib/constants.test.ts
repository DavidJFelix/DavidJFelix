import {expect, test, vi} from 'vitest'

import {CODE_VIEW_BATCH_COUNT, getInitialBatchSize} from './constants'

test('the first batch has the default size when there is no window', () => {
  expect(getInitialBatchSize()).toBe(CODE_VIEW_BATCH_COUNT)
})

test.each([
  {name: 'a short viewport keeps the default size', viewport: {innerHeight: 300}, size: 25},
  {name: 'a tall viewport fills it with rows', viewport: {innerHeight: 1200}, size: 50},
  {name: 'a very tall viewport stops at the maximum', viewport: {innerHeight: 10_000}, size: 96},
  {
    name: 'the visual viewport wins over the window height',
    viewport: {innerHeight: 300, visualViewport: {height: 1200}},
    size: 50,
  },
  {name: 'a zero height keeps the default size', viewport: {innerHeight: 0}, size: 25},
  {
    name: 'a height that is not a number keeps the default size',
    viewport: {innerHeight: Number.NaN},
    size: 25,
  },
])('$name', ({viewport, size}) => {
  vi.stubGlobal('window', viewport)
  expect(getInitialBatchSize()).toBe(size)
})
