import {expect, test} from 'vitest'
import {
  chunkPullRequestFiles,
  isReviewableFile,
  type PullRequestFile,
  renderChunk,
} from './review-chunks'

const addedLines = (start: number, count: number) =>
  [`@@ -0,0 +${start},${count} @@`, ...Array.from({length: count}, (_, i) => `+line ${i}`)].join(
    '\n',
  )

test.each([
  {path: 'src/app.ts', status: 'modified', patch: '@@ -1 +1 @@\n+a', expected: true},
  {path: 'src/app.ts', status: 'removed', patch: '@@ -1 +0,0 @@\n-a', expected: false},
  {path: 'logo.png', status: 'added', patch: undefined, expected: false},
  {
    path: 'workspaces/web-apps/bun.lock',
    status: 'modified',
    patch: '@@ -1 +1 @@\n+a',
    expected: false,
  },
  {path: 'dist/app.min.js', status: 'modified', patch: '@@ -1 +1 @@\n+a', expected: false},
] as const)('isReviewableFile($path, $status) is $expected', ({expected, ...file}) => {
  expect(isReviewableFile(file)).toBe(expected)
})

test('chunkPullRequestFiles keeps small hunks of one file in one chunk', () => {
  const files: PullRequestFile[] = [
    {path: 'a.ts', status: 'modified', patch: `${addedLines(1, 3)}\n${addedLines(50, 3)}`},
  ]

  const chunks = chunkPullRequestFiles(files)

  expect(chunks).toHaveLength(1)
  expect(chunks[0].hunks).toHaveLength(2)
})

test('chunkPullRequestFiles starts a new chunk when the line budget is spent', () => {
  const files: PullRequestFile[] = [
    {path: 'a.ts', status: 'modified', patch: `${addedLines(1, 3)}\n${addedLines(50, 3)}`},
    {path: 'b.ts', status: 'added', patch: addedLines(1, 2)},
  ]

  const chunks = chunkPullRequestFiles(files, {maxLinesPerChunk: 4})

  expect(chunks.map((chunk) => [chunk.path, chunk.hunks.length])).toEqual([
    ['a.ts', 1],
    ['a.ts', 1],
    ['b.ts', 1],
  ])
})

test('chunkPullRequestFiles splits a hunk larger than the line budget', () => {
  const files: PullRequestFile[] = [{path: 'a.ts', status: 'added', patch: addedLines(1, 10)}]

  const chunks = chunkPullRequestFiles(files, {maxLinesPerChunk: 4})

  expect(chunks.map((chunk) => chunk.hunks[0].lines.length)).toEqual([4, 4, 2])
})

test('renderChunk labels new-side lines from 1 and maps labels to file lines', () => {
  const [chunk] = chunkPullRequestFiles([
    {
      path: 'a.ts',
      status: 'modified',
      patch: '@@ -7,2 +7,2 @@\n ctx\n-old\n+new\n@@ -30 +30 @@\n+more',
    },
  ])

  const rendered = renderChunk(chunk)

  expect(rendered.text).toBe(
    ['File: a.ts', '', '    1   ctx', '      - old', '    2 + new', '  ...', '    3 + more'].join(
      '\n',
    ),
  )
  expect(rendered.newLineByLabel).toEqual([7, 8, 30])
})

const renderAddedPairAt = (start: number) =>
  renderChunk(
    chunkPullRequestFiles([{path: 'a.ts', status: 'modified', patch: addedLines(start, 2)}])[0],
  )

test('renderChunk text does not change when the chunk moves down the file', () => {
  expect(renderAddedPairAt(1).text).toBe(renderAddedPairAt(100).text)
  expect(renderAddedPairAt(100).newLineByLabel).toEqual([100, 101])
})
