import {expect, test} from 'vitest'
import {z} from 'zod'
import type {Finding} from './findings'
import type {GitHubRequest} from './github-api'
import {APP_BOT_LOGIN} from './publish-review'
import {findingSummary, neutralizeMarkdown} from './review-markdown'
import {
  formatRunSection,
  formatSummaryComment,
  MAX_COMMENT_CHARS,
  type RunSection,
  readOlderRuns,
  readRunSections,
  SUMMARY_MARKER,
  updateSummaryComment,
} from './summary-comment'
import {createMemorySummaryCommentLock} from './summary-comment-lock'

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b)
const firstSha = 'a'.repeat(40)
const secondSha = 'b'.repeat(40)
const bugFingerprint = '0123456789abcdef'
const nitFingerprint = 'fedcba9876543210'

const firstRun = formatRunSection({
  checkRunId: 31,
  headSha: firstSha,
  costUsd: 0.12345,
  title: '2 findings',
  findings: [
    {fingerprint: bugFingerprint, text: '**high** `src/a.ts:2` (security): Bug'},
    {fingerprint: nitFingerprint, text: '**medium** `src/b.ts:4` (comments): Nit'},
  ],
  details: '### Not reviewed\n\n- `image.png`: binary',
})
const secondRun = formatRunSection({
  checkRunId: 32,
  headSha: secondSha,
  costUsd: 0.01,
  title: 'No findings',
  findings: [],
})

const RUN_COST = 0.1234

interface RunWithParams {
  checkRunId: number
  findingCount: number
  detailChars?: number
}

function runWith({checkRunId, findingCount, detailChars = 0}: RunWithParams): RunSection {
  return formatRunSection({
    checkRunId,
    headSha: firstSha,
    costUsd: RUN_COST,
    title: `${findingCount} findings`,
    findings: Array.from({length: findingCount}, (_, index) => ({
      fingerprint: (checkRunId * 10_000 + index).toString(16).padStart(16, '0'),
      text: `**medium** \`src/a.ts:${index + 1}\` (comments): Finding ${index} of run ${checkRunId}`,
    })),
    ...(detailChars === 0 ? {} : {details: 'x'.repeat(detailChars)}),
  })
}

test('formatSummaryComment shows each run under a running total', () => {
  expect(formatSummaryComment([firstRun, secondRun])).toBe(
    [
      SUMMARY_MARKER,
      '## Revision City',
      '',
      '2 runs on this pull request, total cost $0.1335.',
      '',
      `<!-- revision-city:run 31 ${firstSha} 0.1235 -->`,
      '### `aaaaaaa`: 2 findings, cost $0.1235',
      '',
      `- **high** \`src/a.ts:2\` (security): Bug <!-- revision-city:finding ${bugFingerprint} -->`,
      `- **medium** \`src/b.ts:4\` (comments): Nit <!-- revision-city:finding ${nitFingerprint} -->`,
      '',
      '<details>',
      '',
      '### Not reviewed',
      '',
      '- `image.png`: binary',
      '',
      '</details>',
      '',
      `<!-- revision-city:run 32 ${secondSha} 0.0100 -->`,
      '### `bbbbbbb`: No findings, cost $0.0100',
    ].join('\n'),
  )
})

test('formatSummaryComment strikes through a resolved finding and keeps its cost', () => {
  const body = formatSummaryComment([firstRun], {resolved: new Set([bugFingerprint])})

  expect(body).toContain(
    `- ~~**high** \`src/a.ts:2\` (security): Bug~~ (resolved) <!-- revision-city:finding ${bugFingerprint} -->`,
  )
  expect(body).toContain(
    `- **medium** \`src/b.ts:4\` (comments): Nit <!-- revision-city:finding ${nitFingerprint} -->`,
  )
  expect(body).toContain('1 run on this pull request, total cost $0.1235.')
})

test('readRunSections reads back the runs, also with resolved findings', () => {
  expect(readRunSections(formatSummaryComment([firstRun, secondRun]))).toEqual([
    firstRun,
    secondRun,
  ])
  expect(
    readRunSections(
      formatSummaryComment([firstRun, secondRun], {resolved: new Set([bugFingerprint])}),
    ),
  ).toEqual([firstRun, secondRun])
})

test('readRunSections does not read a marker that neutralized text holds', () => {
  const forged = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 0,
    title: 'No findings',
    findings: [],
    details: `<${ZERO_WIDTH_SPACE}!-- revision-city:run 32 ${secondSha} 9.0000 -->`,
  })

  expect(readRunSections(formatSummaryComment([forged]))).toEqual([forged])
})

test('readOlderRuns does not read a marker in the text of a run', () => {
  const forged = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 0,
    title: 'No findings',
    findings: [],
    details: '<!-- revision-city:older 9 9.0000 -->',
  })

  expect(readOlderRuns(formatSummaryComment([forged]))).toEqual({count: 0, costUsd: 0})
})

test.each([
  {name: 'line', separator: String.fromCharCode(0x2028)},
  {name: 'paragraph', separator: String.fromCharCode(0x2029)},
])('readRunSections reads back a finding whose title holds a $name separator', ({separator}) => {
  const finding: Finding = {
    reviewerId: 'security',
    path: 'src/a.ts',
    severity: 'high',
    title: `Token${separator}leaks`,
    body: 'The token reaches the log.',
    checked: true,
    startLine: 4,
    endLine: 4,
  }
  const section = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 0,
    title: '1 finding',
    findings: [{fingerprint: bugFingerprint, text: neutralizeMarkdown(findingSummary(finding))}],
  })

  const [read] = readRunSections(formatSummaryComment([section]))

  expect(read?.findings).toEqual([
    {fingerprint: bugFingerprint, text: '**high** `src/a.ts:4` (security): Token leaks'},
  ])
})

test('formatSummaryComment cuts the details of the oldest runs first and keeps findings', () => {
  const longRun = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 1,
    title: '2 findings',
    findings: firstRun.findings,
    details: 'x'.repeat(MAX_COMMENT_CHARS / 2),
  })

  const body = formatSummaryComment([longRun, longRun, longRun])

  expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS)
  expect(body).toContain('3 runs on this pull request, total cost $3.0000.')
  const sections = readRunSections(body)
  expect(sections.map(({details}) => details.startsWith('(Cut:'))).toEqual([true, true, false])
  expect(sections.map(({findings}) => findings)).toEqual([
    firstRun.findings,
    firstRun.findings,
    firstRun.findings,
  ])
})

test('formatSummaryComment keeps the newest run and counts each run over 400 edits', () => {
  const runs = Array.from({length: 400}, (_, index) =>
    runWith({checkRunId: index + 1, findingCount: 10, detailChars: 4000}),
  )

  const lastBody = runs.reduce((body, section) => {
    const next = formatSummaryComment([...readRunSections(body), section], {
      older: readOlderRuns(body),
    })
    const shown = readRunSections(next)
    const {checkRunId} = section
    expect(next.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS)
    expect(shown.at(-1)?.checkRunId).toBe(checkRunId)
    expect(shown.at(-1)?.findings).toEqual(section.findings)
    expect(readOlderRuns(next).count + shown.length).toBe(checkRunId)
    expect(next).toContain(
      `${checkRunId} ${checkRunId === 1 ? 'run' : 'runs'} on this pull request, total cost $${(checkRunId * RUN_COST).toFixed(4)}.`,
    )
    return next
  }, '')

  const older = readOlderRuns(lastBody)
  expect(older.count).toBeGreaterThan(0)
  expect(older.costUsd.toFixed(4)).toBe((older.count * RUN_COST).toFixed(4))
  expect(lastBody).toContain(`The oldest ${older.count} runs are not shown.`)
  expect(
    readRunSections(lastBody)
      .slice(0, -1)
      .every(({findings}) => findings.length === 0),
  ).toBe(true)
})

test('formatSummaryComment cuts the findings of the oldest runs before it removes a run', () => {
  const runs = [1, 2, 3, 4].map((checkRunId) => runWith({checkRunId, findingCount: 150}))

  const body = formatSummaryComment(runs)

  expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS)
  expect(readOlderRuns(body)).toEqual({count: 0, costUsd: 0})
  const sections = readRunSections(body)
  expect(sections.map(({findings}) => findings.length)).toEqual([0, 150, 150, 150])
  expect(sections[0]?.details).toBe('(Cut: the comment is longer than GitHub accepts.)')
})

test('formatSummaryComment keeps whole finding lines when the newest run alone is too long', () => {
  const newest = runWith({checkRunId: 2, findingCount: 1000})

  const body = formatSummaryComment([runWith({checkRunId: 1, findingCount: 1}), newest])

  expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS)
  expect(body).toContain(
    '2 runs on this pull request, total cost $0.2468. The oldest run is not shown.',
  )
  expect(readOlderRuns(body)).toEqual({count: 1, costUsd: RUN_COST})
  const [shown, ...rest] = readRunSections(body)
  expect(rest).toEqual([])
  expect(shown?.checkRunId).toBe(2)
  expect(shown?.findings.length).toBeGreaterThan(500)
  expect(newest.findings.slice(0, shown?.findings.length)).toEqual(shown?.findings)
  expect(body.endsWith(' -->')).toBe(true)
})

interface RecordedRequest {
  method: string
  path: string
  body?: unknown
}

const COMMENTS = 'GET /repos/acme/repo/issues/7/comments?per_page=100&page=1'

function fakeGitHub(comments: unknown[]) {
  const calls: RecordedRequest[] = []
  const request: GitHubRequest = async ({method = 'GET', path, body, schema}) => {
    calls.push({method, path, ...(body === undefined ? {} : {body})})
    return schema.parse(`${method} ${path}` === COMMENTS ? comments : {})
  }
  const writes = () =>
    calls
      .filter(({method}) => method !== 'GET')
      .map(({method, path, body}) => ({
        method,
        path,
        body: z.object({body: z.string()}).parse(body).body,
      }))
  return {request, writes}
}

const pull = {repository: {owner: 'acme', name: 'repo'}, pullNumber: 7, resolvedFingerprints: []}
const unlocked = () => ({lock: createMemorySummaryCommentLock()})

test('updateSummaryComment posts the comment when the pull request has none', async () => {
  const github = fakeGitHub([
    {id: 1, body: null, user: null},
    {id: 2, body: `${SUMMARY_MARKER} copied by a person`, user: {login: 'someone'}},
  ])

  await updateSummaryComment({...pull, ...unlocked(), request: github.request, section: firstRun})

  expect(github.writes()).toEqual([
    {
      method: 'POST',
      path: '/repos/acme/repo/issues/7/comments',
      body: formatSummaryComment([firstRun]),
    },
  ])
})

test('updateSummaryComment adds the run and shows the resolved findings of every run', async () => {
  const github = fakeGitHub([
    {id: 3, body: formatSummaryComment([firstRun]), user: {login: APP_BOT_LOGIN}},
  ])

  await updateSummaryComment({
    ...pull,
    ...unlocked(),
    request: github.request,
    section: secondRun,
    resolvedFingerprints: [nitFingerprint],
  })

  expect(github.writes()).toEqual([
    {
      method: 'PATCH',
      path: '/repos/acme/repo/issues/comments/3',
      body: formatSummaryComment([firstRun, secondRun], {resolved: new Set([nitFingerprint])}),
    },
  ])
})

test('updateSummaryComment does not add a run that the comment has already', async () => {
  const github = fakeGitHub([
    {id: 3, body: formatSummaryComment([firstRun, secondRun]), user: {login: APP_BOT_LOGIN}},
  ])

  await updateSummaryComment({...pull, ...unlocked(), request: github.request, section: secondRun})

  expect(github.writes()).toEqual([])
})

test('updateSummaryComment throws and writes nothing while another run holds the lock', async () => {
  const github = fakeGitHub([])
  const lock = createMemorySummaryCommentLock()
  await lock.acquire({pullRequest: 'acme/repo#7', holder: 'check-run:30'})

  await expect(
    updateSummaryComment({...pull, lock, request: github.request, section: firstRun}),
  ).rejects.toThrow('Another run is editing the summary comment')
  expect(github.writes()).toEqual([])
})

test('updateSummaryComment releases the lock after a failed write', async () => {
  const lock = createMemorySummaryCommentLock()
  const request: GitHubRequest = async () => {
    throw new Error('GitHub is down')
  }

  await expect(updateSummaryComment({...pull, lock, request, section: firstRun})).rejects.toThrow(
    'GitHub is down',
  )
  expect(await lock.acquire({pullRequest: 'acme/repo#7', holder: 'check-run:30'})).toBe(true)
})

test('updateSummaryComment ignores a failed release, because the lease expires', async () => {
  const github = fakeGitHub([])
  const lock = {
    acquire: async () => true,
    release: async () => {
      throw new Error('D1 is down')
    },
  }

  await updateSummaryComment({...pull, lock, request: github.request, section: firstRun})

  expect(github.writes()).toHaveLength(1)
})
