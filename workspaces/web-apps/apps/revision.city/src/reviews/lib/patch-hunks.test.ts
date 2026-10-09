import {expect, test} from 'vitest'
import {parsePatchHunks} from './patch-hunks'

test('parsePatchHunks numbers added and context lines on the new side', () => {
  const patch = ['@@ -10,3 +10,3 @@ function f() {', ' keep', '-old', '+new', ' tail'].join('\n')

  const [hunk] = parsePatchHunks(patch)

  expect(hunk.lines).toEqual([
    {kind: 'context', text: 'keep', newLine: 10},
    {kind: 'removed', text: 'old'},
    {kind: 'added', text: 'new', newLine: 11},
    {kind: 'context', text: 'tail', newLine: 12},
  ])
})

test('parsePatchHunks splits on each hunk header and restarts numbering', () => {
  const patch = ['@@ -1 +1 @@', '+a', '@@ -40,0 +41,2 @@', '+b', '+c'].join('\n')

  const hunks = parsePatchHunks(patch)

  expect(hunks).toMatchObject([{lines: [{newLine: 1}]}, {lines: [{newLine: 41}, {newLine: 42}]}])
})

test('parsePatchHunks ignores text before the first hunk and no-newline markers', () => {
  const patch = ['index 123..456', '@@ -1 +1 @@', '-a', '+b', '\\ No newline at end of file'].join(
    '\n',
  )

  const [hunk] = parsePatchHunks(patch)

  expect(hunk.lines.map((line) => line.kind)).toEqual(['removed', 'added'])
})

test('parsePatchHunks returns nothing for an empty patch', () => {
  expect(parsePatchHunks('')).toEqual([])
})
