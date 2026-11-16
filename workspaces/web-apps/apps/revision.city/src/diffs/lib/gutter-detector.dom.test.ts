import {expect, test, vi} from 'vitest'

import {detectGutterSize} from './gutter-detector'

// jsdom does no layout, so the probe sizes come from stubbed element getters.
const stubProbeSizes = (sizes: {
  offsetWidth: number
  clientWidth: number
  offsetHeight: number
  clientHeight: number
}) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(sizes.offsetWidth)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(sizes.offsetHeight)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(sizes.clientWidth)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(sizes.clientHeight)
}

test('measures the scrollbar gutter of a class and removes the probe', () => {
  stubProbeSizes({offsetWidth: 100, clientWidth: 85, offsetHeight: 100, clientHeight: 90})

  expect(detectGutterSize('measured-gutter')).toEqual({vertical: 15, horizontal: 10})
  expect(document.body.childElementCount).toBe(0)
})

test('reports no gutter when the client area is larger than the probe', () => {
  stubProbeSizes({offsetWidth: 100, clientWidth: 120, offsetHeight: 100, clientHeight: 110})

  expect(detectGutterSize('overlay-gutter')).toEqual({vertical: 0, horizontal: 0})
})

test('gives the cached size for a class until the cache is ignored', () => {
  stubProbeSizes({offsetWidth: 100, clientWidth: 85, offsetHeight: 100, clientHeight: 85})
  const first = detectGutterSize('cached-gutter')

  stubProbeSizes({offsetWidth: 100, clientWidth: 92, offsetHeight: 100, clientHeight: 92})
  expect(detectGutterSize('cached-gutter')).toBe(first)
  expect(detectGutterSize('cached-gutter', true)).toEqual({vertical: 8, horizontal: 8})
})
