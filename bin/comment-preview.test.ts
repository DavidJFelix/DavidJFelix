import {expect, test} from 'bun:test'
import {buildCommentBody} from './comment-preview'

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
  expect(body).toContain('- Smoke: ❌ failed')
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
  expect(body).toContain('- Smoke: ✅ passed')
  expect(body).toContain('- Screenshots: ❌ failed')
})

test('all stages passing renders the link and two passed lines', () => {
  const body = buildCommentBody({
    ...base,
    deployOutcome: 'success',
    smokeOutcome: 'success',
    e2eOutcome: 'success',
  })

  expect(body).toContain('- Preview: https://pr-7-app.acct.workers.dev/')
  expect(body).toContain('- Smoke: ✅ passed')
  expect(body).toContain('- Screenshots: ✅ passed')
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
