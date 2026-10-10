import {expect, test} from 'vitest'
import {anchorFindings, decideOutcome, type Finding, isAtLeast, type ModelFinding} from './findings'
import {chunkPullRequestFiles, renderChunk} from './review-chunks'

const [chunk] = chunkPullRequestFiles([
  {path: 'a.ts', status: 'modified', patch: '@@ -20,2 +20,3 @@\n ctx\n-old\n+new\n+next'},
])
const rendered = renderChunk(chunk)

const modelFinding = (overrides: Partial<ModelFinding>): ModelFinding => ({
  severity: 'high',
  title: 'Problem',
  body: 'Details',
  label: 1,
  ...overrides,
})

const finding = (overrides: Partial<Finding>): Finding => ({
  reviewerId: 'correctness',
  path: 'a.ts',
  severity: 'high',
  title: 'Problem',
  body: 'Details',
  startLine: 1,
  endLine: 1,
  ...overrides,
})

test.each([
  {severity: 'critical', threshold: 'high', expected: true},
  {severity: 'high', threshold: 'high', expected: true},
  {severity: 'medium', threshold: 'high', expected: false},
] as const)('isAtLeast($severity, $threshold) is $expected', ({severity, threshold, expected}) => {
  expect(isAtLeast({severity, threshold})).toBe(expected)
})

test('anchorFindings maps a label to its new-file line', () => {
  const [anchored] = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({label: 2, suggestion: 'fixed'})],
  })

  expect(anchored).toEqual({
    reviewerId: 'security',
    path: 'a.ts',
    severity: 'high',
    title: 'Problem',
    body: 'Details',
    startLine: 21,
    endLine: 21,
    suggestion: 'fixed',
  })
})

test('anchorFindings turns a valid end label into a line range and keeps its suggestion', () => {
  const [anchored] = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({label: 2, endLabel: 3, suggestion: 'fixed'})],
  })

  expect([anchored.startLine, anchored.endLine, anchored.suggestion]).toEqual([21, 22, 'fixed'])
})

test('anchorFindings cuts a range that leaves the chunk or ends before it starts, and drops its suggestion', () => {
  const anchored = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [
      modelFinding({label: 2, endLabel: 9, suggestion: 'fixed'}),
      modelFinding({label: 2, endLabel: 1, suggestion: 'fixed'}),
    ],
  })

  expect(anchored.map((item) => [item.startLine, item.endLine, item.suggestion])).toEqual([
    [21, 21, undefined],
    [21, 21, undefined],
  ])
})

test('anchorFindings cuts a range that crosses the gap between two hunks', () => {
  const [twoHunks] = chunkPullRequestFiles([
    {
      path: 'a.ts',
      status: 'modified',
      patch: '@@ -1,1 +1,2 @@\n ctx\n+first\n@@ -10,1 +11,2 @@\n ctx\n+second',
    },
  ])

  const [anchored] = anchorFindings({
    reviewerId: 'correctness',
    chunk: twoHunks,
    rendered: renderChunk(twoHunks),
    findings: [modelFinding({label: 2, endLabel: 4, suggestion: 'fixed'})],
  })

  expect([anchored.startLine, anchored.endLine, anchored.suggestion]).toEqual([2, 2, undefined])
})

test('anchorFindings drops a finding whose label is not in the chunk', () => {
  expect(
    anchorFindings({reviewerId: 'security', chunk, rendered, findings: [modelFinding({label: 9})]}),
  ).toEqual([])
})

test('decideOutcome reports medium and above and fails on high and above', () => {
  const outcome = decideOutcome([
    finding({severity: 'low', startLine: 1, endLine: 1}),
    finding({severity: 'medium', startLine: 2, endLine: 2}),
    finding({severity: 'high', startLine: 3, endLine: 3}),
  ])

  expect(outcome.reported.map((item) => item.severity)).toEqual(['high', 'medium'])
  expect(outcome.failed).toBe(true)
})

test('decideOutcome passes when nothing reaches the fail severity', () => {
  expect(decideOutcome([finding({severity: 'medium'})]).failed).toBe(false)
})

test('decideOutcome fails when a chunk review failed', () => {
  expect(decideOutcome([], {failedChunkReviewCount: 1}).failed).toBe(true)
})

test('decideOutcome keeps only the most severe of findings that end on the same line', () => {
  const outcome = decideOutcome([
    finding({reviewerId: 'correctness', severity: 'medium', startLine: 3, endLine: 3}),
    finding({reviewerId: 'security', severity: 'critical', startLine: 1, endLine: 3}),
  ])

  expect(outcome.reported.map((item) => item.reviewerId)).toEqual(['security'])
})

test('decideOutcome keeps a finding inside the range of a more severe finding', () => {
  const outcome = decideOutcome([
    finding({reviewerId: 'comments', severity: 'critical', startLine: 1, endLine: 40}),
    finding({reviewerId: 'correctness', severity: 'high', startLine: 12, endLine: 12}),
  ])

  expect(outcome.reported.map((item) => item.reviewerId)).toEqual(['comments', 'correctness'])
})

test('decideOutcome keeps findings on the same line of different files', () => {
  const outcome = decideOutcome([finding({path: 'a.ts'}), finding({path: 'b.ts'})])

  expect(outcome.reported).toHaveLength(2)
})

test('anchorFindings keeps an empty suggestion, which deletes the flagged lines', () => {
  const [anchored] = anchorFindings({
    reviewerId: 'correctness',
    chunk,
    rendered,
    findings: [modelFinding({label: 2, suggestion: ''})],
  })

  expect(anchored.suggestion).toBe('')
})
