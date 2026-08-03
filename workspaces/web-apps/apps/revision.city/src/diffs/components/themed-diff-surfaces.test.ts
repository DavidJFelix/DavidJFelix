import {expect, test} from 'vitest'

import {ThemedCodeView} from './themed-code-view'
import {ThemedFile} from './themed-file'
import {ThemedFileDiff} from './themed-file-diff'

test('themed diffs surfaces: exports React diff surface components', () => {
  expect(ThemedCodeView).toBeDefined()
  expect(typeof ThemedFile).toBe('function')
  expect(typeof ThemedFileDiff).toBe('function')
})
