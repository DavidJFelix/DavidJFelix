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
  expect(isAtLeast(severity, threshold)).toBe(expected)
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

test('anchorFindings turns a valid end label into a line range', () => {
  const [anchored] = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({label: 2, endLabel: 3})],
  })

  expect([anchored.startLine, anchored.endLine]).toEqual([21, 22])
})

test('anchorFindings drops a range end that is outside the chunk or not after the start', () => {
  const anchored = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({label: 2, endLabel: 9}), modelFinding({label: 2, endLabel: 1})],
  })

  expect(anchored.map((item) => [item.startLine, item.endLine])).toEqual([
    [21, 21],
    [21, 21],
  ])
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

test('decideOutcome keeps only the most severe of findings whose lines overlap', () => {
  const outcome = decideOutcome([
    finding({reviewerId: 'correctness', severity: 'medium', startLine: 3, endLine: 3}),
    finding({reviewerId: 'security', severity: 'critical', startLine: 1, endLine: 3}),
    finding({reviewerId: 'comments', severity: 'medium', startLine: 4, endLine: 5}),
  ])

  expect(outcome.reported.map((item) => [item.reviewerId, item.startLine])).toEqual([
    ['security', 1],
    ['comments', 4],
  ])
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
