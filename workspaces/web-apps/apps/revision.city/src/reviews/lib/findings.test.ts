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
  line: 1,
  ...overrides,
})

const finding = (overrides: Partial<Finding>): Finding => ({
  reviewerId: 'correctness',
  path: 'a.ts',
  severity: 'high',
  title: 'Problem',
  body: 'Details',
  line: 1,
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
    findings: [modelFinding({line: 2, suggestion: 'fixed'})],
  })

  expect(anchored).toEqual({
    reviewerId: 'security',
    path: 'a.ts',
    severity: 'high',
    title: 'Problem',
    body: 'Details',
    line: 21,
    suggestion: 'fixed',
  })
})

test('anchorFindings turns a valid end label into a line range', () => {
  const [anchored] = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({line: 2, endLine: 3})],
  })

  expect([anchored.startLine, anchored.line]).toEqual([21, 22])
})

test('anchorFindings drops a range end that is outside the chunk or not after the start', () => {
  const anchored = anchorFindings({
    reviewerId: 'security',
    chunk,
    rendered,
    findings: [modelFinding({line: 2, endLine: 9}), modelFinding({line: 2, endLine: 1})],
  })

  expect(anchored.map((item) => [item.startLine, item.line])).toEqual([
    [undefined, 21],
    [undefined, 21],
  ])
})

test('anchorFindings drops a finding whose label is not in the chunk', () => {
  expect(
    anchorFindings({reviewerId: 'security', chunk, rendered, findings: [modelFinding({line: 9})]}),
  ).toEqual([])
})

test('decideOutcome reports medium and above and fails on high and above', () => {
  const outcome = decideOutcome([
    finding({severity: 'low', line: 1}),
    finding({severity: 'medium', line: 2}),
    finding({severity: 'high', line: 3}),
  ])

  expect(outcome.reported.map((item) => item.severity)).toEqual(['high', 'medium'])
  expect(outcome.failed).toBe(true)
})

test('decideOutcome passes when nothing reaches the fail severity', () => {
  expect(decideOutcome([finding({severity: 'medium'})]).failed).toBe(false)
})

test('decideOutcome keeps the most severe copy of a repeated finding', () => {
  const outcome = decideOutcome([
    finding({reviewerId: 'correctness', severity: 'medium', title: 'Null check missing'}),
    finding({reviewerId: 'security', severity: 'critical', title: 'null check missing '}),
  ])

  expect(outcome.reported).toEqual([
    finding({reviewerId: 'security', severity: 'critical', title: 'null check missing '}),
  ])
})
