import {serialize} from 'node:v8'
import {expect, test} from 'vitest'
import type {PullRequestFile} from './review-chunks'
import {selectReviewFiles} from './select-review-files'

const modified = (path: string, patch?: string): PullRequestFile => ({
  path,
  status: 'modified',
  patch,
})

const patchOf = (lineCount: number, line = 'x') =>
  [`@@ -1,1 +1,${lineCount} @@`, ...Array.from({length: lineCount}, () => `+${line}`)].join('\n')

test('selectReviewFiles keeps reviewable files in order and leaves out skipped files with no note', () => {
  const files: PullRequestFile[] = [
    modified('src/b.ts', patchOf(1)),
    modified('bun.lock', patchOf(1)),
    {path: 'src/old.ts', status: 'removed', patch: patchOf(1)},
    modified('src/a.ts', patchOf(1)),
  ]

  expect(selectReviewFiles(files)).toEqual({files: [files[0], files[3]], notReviewed: []})
})

test('selectReviewFiles lists a file with no text diff and a file over the line limit', () => {
  const files = [
    modified('image.png'),
    modified('generated.ts', patchOf(1600)),
    modified('src/a.ts', patchOf(1)),
  ]

  expect(selectReviewFiles(files)).toEqual({
    files: [files[2]],
    notReviewed: [
      {path: 'image.png', reason: 'GitHub shows no text diff'},
      {path: 'generated.ts', reason: 'the diff is longer than 1500 lines'},
    ],
  })
})

test('selectReviewFiles keeps a later file that fits in what is left of the size limit', () => {
  // About 402,000 bytes each, so two do not fit in 700,000.
  const files = [
    modified('a.ts', patchOf(1000, 'x'.repeat(400))),
    modified('b.ts', patchOf(1000, 'x'.repeat(400))),
    modified('c.ts', patchOf(1)),
  ]

  expect(selectReviewFiles(files)).toEqual({
    files: [files[0], files[2]],
    notReviewed: [{path: 'b.ts', reason: 'over the review size limit'}],
  })
})

test('selectReviewFiles counts 2 bytes for each character of a patch with a character above U+00FF', () => {
  // About 452,000 characters each: under the limit at 1 byte for each character,
  // and over it at 2.
  const files = [
    modified('two-byte.ts', patchOf(1000, '\u0101'.repeat(450))),
    modified('latin-1.ts', patchOf(1000, '\u00e9'.repeat(450))),
  ]

  expect(selectReviewFiles(files)).toEqual({
    files: [files[1]],
    notReviewed: [{path: 'two-byte.ts', reason: 'over the review size limit'}],
  })
})

test('selectReviewFiles keeps its result under the 1 MiB limit for a Workflow step result', () => {
  const files = [
    ...Array.from({length: 10}, (_, index) =>
      modified(`src/${index}.ts`, patchOf(1400, 'x'.repeat(69))),
    ),
    // Each character of these paths takes 2 bytes.
    ...Array.from({length: 2990}, (_, index) =>
      modified(`images/${'\u0101'.repeat(240)}-${index}.png`),
    ),
  ]

  const selection = selectReviewFiles(files)

  expect(serialize(selection).byteLength).toBeLessThan(2 ** 20)
  expect(selection.files).toHaveLength(7)
  expect(selection.notReviewed).toContainEqual({
    path: 'src/7.ts',
    reason: 'over the review size limit',
  })
  expect(selection.notReviewed.length).toBeLessThan(files.length - selection.files.length)
})

test('selectReviewFiles keeps its result under the step result limit when one path is very long', () => {
  const selection = selectReviewFiles([modified(`${'\u0101'.repeat(600_000)}.png`)])

  expect(serialize(selection).byteLength).toBeLessThan(2 ** 20)
  expect(selection.notReviewed[0].path).toHaveLength(65_000)
})

test('selectReviewFiles keeps each path that it leaves out on one line and counts it as shown', () => {
  const files = [modified(`a\n${' '.repeat(70_000)}.png`), modified('b.png')]

  expect(selectReviewFiles(files).notReviewed).toEqual([
    {path: 'a .png', reason: 'GitHub shows no text diff'},
    {path: 'b.png', reason: 'GitHub shows no text diff'},
  ])
})
