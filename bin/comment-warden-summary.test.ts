import {expect, test} from 'bun:test'
import type {GhClient, GhResponse} from './comment-warden-summary'
import {
  MARKER,
  buildCommentBody,
  formatDuration,
  summarizeFindingsFile,
  upsertComment,
} from './comment-warden-summary'

const repo = 'DavidJFelix/DavidJFelix'
const headSha = '46f59e1e652f8868b2e311463e73ef199c693ec4'

test('the body leads with the marker, names the head, and tabulates every skill', () => {
  const body = buildCommentBody({
    repo,
    headSha,
    summary: {
      totalFindings: 0,
      skills: [
        {
          name: 'security-review',
          findings: 0,
          durationMs: 126_000,
          costUsd: 0.0149,
          checkRunUrl: 'https://github.com/DavidJFelix/DavidJFelix/runs/1',
        },
        {name: 'code-review', findings: 0, durationMs: 327_000, costUsd: 0.12},
      ],
    },
  })

  expect(body).toBe(
    `${MARKER}\n` +
      'Warden reviewed [`46f59e1`](https://github.com/DavidJFelix/DavidJFelix/commit/46f59e1e652f8868b2e311463e73ef199c693ec4): no findings.\n' +
      '\n' +
      '| Skill | Findings | Duration | Cost |\n' +
      '| --- | --- | --- | --- |\n' +
      '| [security-review](https://github.com/DavidJFelix/DavidJFelix/runs/1) | 0 | 2m 6s | $0.01 |\n' +
      '| code-review | 0 | 5m 27s | $0.12 |',
  )
})

test('findings are counted in the headline and a skill error replaces its count', () => {
  const body = buildCommentBody({
    repo,
    headSha,
    summary: {
      totalFindings: 1,
      skills: [
        {name: 'security-review', findings: 1, durationMs: 4000, costUsd: 0},
        {name: 'code-review', findings: 0, error: 'model | catalog\nmiss'},
      ],
    },
  })

  expect(body).toContain(': 1 finding.\n')
  expect(body).toContain('| security-review | 1 | 4s | $0.00 |')
  expect(body).toContain('| code-review | error: model \\| catalog miss |  |  |')
})

test.each([
  [0, '0s'],
  [11_600, '12s'],
  [59_400, '59s'],
  [60_000, '1m 0s'],
  [126_000, '2m 6s'],
])('formatDuration(%d) is %s', (ms, expected) => {
  expect(formatDuration(ms)).toBe(expected)
})

test('summarizeFindingsFile lifts what the comment needs out of the findings file', () => {
  const summary = summarizeFindingsFile({
    version: '1',
    summary: {totalFindings: 2, findingsBySeverity: {high: 1, medium: 1, low: 0}},
    skills: [
      {
        name: 'security-review',
        summary: 'x',
        findings: [{id: 'a'}, {id: 'b'}],
        durationMs: 1000,
        usage: {inputTokens: 1, outputTokens: 1, costUSD: 0.5},
        checkRunUrl: 'https://example.test/run',
      },
      {
        name: 'code-review',
        summary: 'y',
        findingsBySeverity: {high: 0, medium: 0, low: 0},
        error: {code: 'runtime_error', message: 'boom'},
      },
    ],
  })

  expect(summary).toEqual({
    totalFindings: 2,
    skills: [
      {
        name: 'security-review',
        findings: 2,
        durationMs: 1000,
        costUsd: 0.5,
        checkRunUrl: 'https://example.test/run',
        error: undefined,
      },
      {
        name: 'code-review',
        findings: 0,
        durationMs: undefined,
        costUsd: undefined,
        checkRunUrl: undefined,
        error: 'boom',
      },
    ],
  })
})

test('summarizeFindingsFile tolerates an empty or malformed file', () => {
  expect(summarizeFindingsFile(undefined)).toEqual({totalFindings: 0, skills: []})
  expect(summarizeFindingsFile({skills: [{name: 'only'}]})).toEqual({
    totalFindings: 0,
    skills: [
      {
        name: 'only',
        findings: 0,
        durationMs: undefined,
        costUsd: undefined,
        checkRunUrl: undefined,
        error: undefined,
      },
    ],
  })
})

interface Call {
  readonly method: string
  readonly path: string
  readonly payload?: unknown
}

interface FakeComment {
  readonly id: number
  readonly body: string
}

const fakeGh = (
  pages: readonly (readonly FakeComment[])[],
  deleteStatus = 204,
): {gh: GhClient; calls: Call[]} => {
  const calls: Call[] = []
  const gh: GhClient = async (method, path, payload): Promise<GhResponse> => {
    calls.push({method, path, payload})
    if (method === 'GET') {
      const page = Number(new URL(`https://x${path}`).searchParams.get('page'))
      return {status: 200, body: pages[page - 1] ?? []}
    }
    if (method === 'POST') return {status: 201, body: {}}
    if (method === 'DELETE') return {status: deleteStatus, body: undefined}
    return {status: 200, body: {}}
  }
  return {gh, calls}
}

const writes = (calls: readonly Call[]): Call[] => calls.filter((call) => call.method !== 'GET')

test('upsertComment posts a new comment when the PR has no summary yet', async () => {
  const {gh, calls} = fakeGh([[{id: 1, body: 'See this change in revision.city'}]])

  const outcome = await upsertComment({gh, repo, prNumber: '629', body: `${MARKER}\nnew`})

  expect(outcome).toEqual({action: 'created', removed: 0})
  expect(writes(calls)).toEqual([
    {
      method: 'POST',
      path: '/repos/DavidJFelix/DavidJFelix/issues/629/comments',
      payload: {body: `${MARKER}\nnew`},
    },
  ])
})

test('upsertComment edits the existing summary comment in place', async () => {
  const {gh, calls} = fakeGh([
    [
      {id: 1, body: 'unrelated'},
      {id: 42, body: `${MARKER}\nold`},
    ],
  ])

  const outcome = await upsertComment({gh, repo, prNumber: '629', body: `${MARKER}\nnew`})

  expect(outcome).toEqual({action: 'updated', removed: 0})
  expect(writes(calls)).toEqual([
    {
      method: 'PATCH',
      path: '/repos/DavidJFelix/DavidJFelix/issues/comments/42',
      payload: {body: `${MARKER}\nnew`},
    },
  ])
})

test('upsertComment keeps the oldest summary and deletes duplicates from overlapping runs', async () => {
  const {gh, calls} = fakeGh([
    [
      {id: 42, body: `${MARKER}\nfirst`},
      {id: 43, body: `${MARKER}\nracer`},
    ],
  ])

  const outcome = await upsertComment({gh, repo, prNumber: '629', body: `${MARKER}\nnew`})

  expect(outcome).toEqual({action: 'updated', removed: 1})
  expect(writes(calls)).toEqual([
    {method: 'DELETE', path: '/repos/DavidJFelix/DavidJFelix/issues/comments/43', payload: undefined},
    {
      method: 'PATCH',
      path: '/repos/DavidJFelix/DavidJFelix/issues/comments/42',
      payload: {body: `${MARKER}\nnew`},
    },
  ])
})

test('upsertComment walks every page, so a summary past page one is still found', async () => {
  const filler = Array.from({length: 100}, (_, i) => ({id: i + 1, body: `comment ${i + 1}`}))
  const {gh, calls} = fakeGh([filler, [{id: 500, body: `${MARKER}\nold`}]])

  const outcome = await upsertComment({gh, repo, prNumber: '629', body: MARKER})

  expect(outcome).toEqual({action: 'updated', removed: 0})
  expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2)
  expect(writes(calls).at(-1)?.path).toBe('/repos/DavidJFelix/DavidJFelix/issues/comments/500')
})

test('upsertComment treats a duplicate that is already gone as deleted', async () => {
  const {gh} = fakeGh(
    [
      [
        {id: 42, body: `${MARKER}\nfirst`},
        {id: 43, body: `${MARKER}\nracer`},
      ],
    ],
    404,
  )

  await expect(upsertComment({gh, repo, prNumber: '629', body: MARKER})).resolves.toEqual({
    action: 'updated',
    removed: 1,
  })
})

test('upsertComment surfaces a failed write', async () => {
  const gh: GhClient = async (method) =>
    method === 'GET' ? {status: 200, body: []} : {status: 403, body: 'Resource not accessible'}

  await expect(upsertComment({gh, repo, prNumber: '629', body: MARKER})).rejects.toThrow(
    'HTTP 403 Resource not accessible',
  )
})
