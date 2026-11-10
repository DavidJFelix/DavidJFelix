import {expect, test} from 'bun:test'
import {buildCommentBody, upsertStickyComment} from './comment-preview'

const base = {
  marker: '<!-- preview-app -->',
  title: 'app preview',
  footer: 'Preview version `pr-7`; replaced on each push, inert once this PR closes.',
  url: 'https://pr-7-app.acct.workers.dev/',
}

test('a failing smoke test keeps the deployed-app link and names the failing stage', () => {
  const body = buildCommentBody({
    ...base,
    deployOutcome: 'success',
    smokeOutcome: 'failure',
    e2eOutcome: 'skipped',
  })

  expect(body).toContain('- Preview: https://pr-7-app.acct.workers.dev/')
  expect(body).toContain('- Smoke: failed')
  expect(body).toContain('- Screenshots: _skipped_')
  expect(body).not.toContain('deploy failed')
})

test('a failing screenshot suite keeps the link and shows smoke passed', () => {
  const body = buildCommentBody({
    ...base,
    deployOutcome: 'success',
    smokeOutcome: 'success',
    e2eOutcome: 'failure',
  })

  expect(body).toContain('- Preview: https://pr-7-app.acct.workers.dev/')
  expect(body).toContain('- Smoke: passed')
  expect(body).toContain('- Screenshots: failed')
})

test('all stages passing renders the link and two passed lines', () => {
  const body = buildCommentBody({
    ...base,
    deployOutcome: 'success',
    smokeOutcome: 'success',
    e2eOutcome: 'success',
  })

  expect(body).toContain('- Preview: https://pr-7-app.acct.workers.dev/')
  expect(body).toContain('- Smoke: passed')
  expect(body).toContain('- Screenshots: passed')
})

test('a failed deploy explains itself instead of linking, and downstream stages read skipped', () => {
  const body = buildCommentBody({
    ...base,
    url: undefined,
    deployOutcome: 'failure',
    smokeOutcome: 'skipped',
    e2eOutcome: 'skipped',
  })

  expect(body).toContain('- Preview: _deploy failed — see the workflow logs_')
  expect(body).not.toContain('workers.dev')
  expect(body).toContain('- Smoke: _skipped_')
  expect(body).toContain('- Screenshots: _skipped_')
})

test('a deploy that never ran (empty outcome) also reads as deploy failed', () => {
  const body = buildCommentBody({
    ...base,
    url: undefined,
    deployOutcome: undefined,
    smokeOutcome: undefined,
    e2eOutcome: undefined,
  })

  expect(body).toContain('- Preview: _deploy failed — see the workflow logs_')
})

test('a successful deploy with no captured URL says so rather than claiming deploy failed', () => {
  const body = buildCommentBody({
    ...base,
    url: undefined,
    deployOutcome: 'success',
    smokeOutcome: 'failure',
    e2eOutcome: 'skipped',
  })

  expect(body).toContain(
    '- Preview: _deployed, but no preview URL was captured — see the workflow logs_',
  )
  expect(body).not.toContain('deploy failed')
})

test('the body opens with the sticky marker and heading the upsert scans for', () => {
  const body = buildCommentBody({
    ...base,
    deployOutcome: 'success',
    smokeOutcome: 'success',
    e2eOutcome: 'success',
  })

  expect(body.startsWith('<!-- preview-app -->\n### app preview\n\n')).toBe(true)
  expect(body.endsWith(`_${base.footer}_`)).toBe(true)
})

test('the upsert edits only the bot marker comment and leaves comments by people alone', async () => {
  const repo = 'owner/repo'
  const bot = {type: 'Bot'}
  const person = {type: 'User'}
  const calls: {method: string; path: string; payload?: unknown}[] = []
  const gh = async (method: string, path: string, payload?: unknown): Promise<unknown> => {
    calls.push({method, path, payload})
    if (method !== 'GET') return undefined
    return [
      {id: 1, body: `${base.marker}\nolder`, user: person},
      {id: 2, body: `${base.marker}\nlast run`, user: bot},
      {id: 3, body: `> ${base.marker}\nquoted`, user: person},
    ]
  }

  await upsertStickyComment({gh, repo, prNumber: '7', marker: base.marker, body: 'new body'})

  expect(calls.filter((call) => call.method !== 'GET')).toEqual([
    {method: 'PATCH', path: `/repos/${repo}/issues/comments/2`, payload: {body: 'new body'}},
  ])
})
