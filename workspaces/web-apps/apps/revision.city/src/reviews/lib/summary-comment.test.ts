import {expect, test} from 'vitest'
import {z} from 'zod'
import type {GitHubRequest} from './github-api'
import {APP_BOT_LOGIN} from './publish-review'
import {
  formatRunSection,
  formatSummaryComment,
  MAX_COMMENT_CHARS,
  readRunSections,
  SUMMARY_MARKER,
  updateSummaryComment,
} from './summary-comment'
import {createMemorySummaryCommentLock} from './summary-comment-lock'

const ZERO_WIDTH_SPACE = '\u200B'
const firstSha = 'a'.repeat(40)
const secondSha = 'b'.repeat(40)

const firstRun = formatRunSection({
  checkRunId: 31,
  headSha: firstSha,
  costUsd: 0.12345,
  output: {title: '1 finding', summary: 'unused', text: '### Findings\n\n- one'},
})
const secondRun = formatRunSection({
  checkRunId: 32,
  headSha: secondSha,
  costUsd: 0.01,
  output: {title: 'No findings', summary: 'unused'},
})

test('formatSummaryComment shows each run under a running total', () => {
  expect(formatSummaryComment([firstRun, secondRun])).toBe(
    [
      SUMMARY_MARKER,
      '## Revision City',
      '',
      '2 runs on this pull request, total cost $0.1335.',
      '',
      `<!-- revision-city:run 31 ${firstSha} 0.1235 -->`,
      '### `aaaaaaa`: 1 finding, cost $0.1235',
      '',
      '<details>',
      '',
      '### Findings',
      '',
      '- one',
      '',
      '</details>',
      '',
      `<!-- revision-city:run 32 ${secondSha} 0.0100 -->`,
      '### `bbbbbbb`: No findings, cost $0.0100',
    ].join('\n'),
  )
})

test('readRunSections reads back the runs of a summary comment', () => {
  expect(readRunSections(formatSummaryComment([firstRun, secondRun]))).toEqual([
    firstRun,
    secondRun,
  ])
})

test('readRunSections does not read a marker that neutralized text holds', () => {
  const forged = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 0,
    output: {
      title: 'No findings',
      summary: 'unused',
      text: `<${ZERO_WIDTH_SPACE}!-- revision-city:run 32 ${secondSha} 9.0000 -->`,
    },
  })

  expect(readRunSections(formatSummaryComment([forged]))).toEqual([forged])
})

test('formatSummaryComment cuts the details of the oldest runs first', () => {
  const longRun = formatRunSection({
    checkRunId: 31,
    headSha: firstSha,
    costUsd: 1,
    output: {title: '1 finding', summary: 'unused', text: 'x'.repeat(MAX_COMMENT_CHARS / 2)},
  })

  const body = formatSummaryComment([longRun, longRun, longRun])

  expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS)
  expect(body).toContain('3 runs on this pull request, total cost $3.0000.')
  expect(readRunSections(body).map(({details}) => details.startsWith('(Details cut:'))).toEqual([
    true,
    true,
    false,
  ])
})

test('formatSummaryComment keeps a comment with too many runs under the limit', () => {
  const runs = Array.from({length: 1000}, () => secondRun)

  expect(formatSummaryComment(runs).length).toBe(MAX_COMMENT_CHARS)
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

const pull = {repository: {owner: 'acme', name: 'repo'}, pullNumber: 7}
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

test('updateSummaryComment adds the run to the comment of the app', async () => {
  const github = fakeGitHub([
    {id: 3, body: formatSummaryComment([firstRun]), user: {login: APP_BOT_LOGIN}},
  ])

  await updateSummaryComment({...pull, ...unlocked(), request: github.request, section: secondRun})

  expect(github.writes()).toEqual([
    {
      method: 'PATCH',
      path: '/repos/acme/repo/issues/comments/3',
      body: formatSummaryComment([firstRun, secondRun]),
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
