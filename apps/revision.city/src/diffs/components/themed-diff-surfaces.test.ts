import {expect, test} from 'vitest'

import {ThemedCodeView} from './ThemedCodeView'
import {ThemedFile} from './ThemedFile'
import {ThemedFileDiff} from './ThemedFileDiff'

test('themed diffs surfaces: exports React diff surface components', () => {
  expect(ThemedCodeView).toBeDefined()
  expect(typeof ThemedFile).toBe('function')
  expect(typeof ThemedFileDiff).toBe('function')
})
