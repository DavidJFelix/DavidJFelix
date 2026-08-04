import {expect, test} from 'vitest'

import {handleEntityDiffRequest} from './entity-diff-endpoint'

const ORIGIN = 'https://revision.city'

function createRequest(params: Record<string, string>): Request {
  return new Request(`${ORIGIN}/api/diffs/entity-diff?${new URLSearchParams(params)}`)
}

test.each([
  ['no parameters at all', {}],
  ['a missing file name', {path: 'o/r/pull/1', type: 'change'}],
  ['a missing diff source', {name: 'src/a.ts', type: 'change'}],
  ['an unsupported change type', {path: 'o/r/pull/1', name: 'src/a.ts', type: 'exploded'}],
])('rejects a request with %s', async (_case, params) => {
  const response = await handleEntityDiffRequest(createRequest(params))

  expect(response.status).toBe(400)
})

test('answers a pure rename without contacting GitHub', async () => {
  // No session cookie rides along, so reaching GitHub would 401 instead.
  const response = await handleEntityDiffRequest(
    createRequest({path: 'o/r/pull/1', name: 'src/moved.ts', type: 'rename-pure'}),
  )

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({
    path: 'src/moved.ts',
    changes: [],
    summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
  })
})

test('reads a public diff without a signed-in session', async () => {
  // No session cookie: the request must reach GitHub anonymously rather than be
  // turned away, since the viewer already shows public diffs signed out.
  const response = await handleEntityDiffRequest(
    createRequest({path: 'o/r/pull/1', name: 'src/a.ts', type: 'change'}),
  )

  expect(response.status).not.toBe(401)
})

test('keeps entity diffs out of shared caches', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({path: 'o/r/pull/1', name: 'src/moved.ts', type: 'rename-pure'}),
  )

  expect(response.headers.get('Cache-Control')).toContain('private')
  expect(response.headers.get('Vary')).toBe('Cookie')
})
