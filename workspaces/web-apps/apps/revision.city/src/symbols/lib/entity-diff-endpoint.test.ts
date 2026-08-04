import {expect, test} from 'vitest'

import {MAX_FILES_PER_REQUEST} from './entity-diff-client'
import {handleEntityDiffRequest} from './entity-diff-endpoint'

const ORIGIN = 'https://revision.city'

function createRequest(body: unknown): Request {
  return new Request(`${ORIGIN}/api/diffs/entity-diff`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function readLines(response: Response): Promise<unknown[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
}

test.each([
  ['a body that is not JSON', 'not json'],
  ['a body with no path', {files: []}],
  ['a body with no files', {path: 'o/r/pull/1'}],
  [
    'a file with an unsupported change type',
    {path: 'o/r/pull/1', files: [{itemId: 'i', name: 'a.ts', type: 'exploded'}]},
  ],
  ['a file with no name', {path: 'o/r/pull/1', files: [{itemId: 'i', type: 'change'}]}],
])('rejects %s', async (_case, body) => {
  const response = await handleEntityDiffRequest(createRequest(body))

  expect(response.status).toBe(400)
})

test('rejects a batch larger than one request should carry', async () => {
  const files = Array.from({length: MAX_FILES_PER_REQUEST + 1}, (_, index) => ({
    itemId: `item-${index}`,
    name: `src/file-${index}.ts`,
    type: 'change',
  }))

  const response = await handleEntityDiffRequest(createRequest({path: 'o/r/pull/1', files}))

  expect(response.status).toBe(400)
  await expect(response.json()).resolves.toMatchObject({
    error: expect.stringContaining('At most'),
  })
})

test('streams newline-delimited results', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toContain('application/x-ndjson')
  await expect(readLines(response)).resolves.toMatchObject([
    {itemId: 'item-1', name: 'src/moved.ts', diff: {changes: []}},
  ])
})

test('answers a pure rename without contacting GitHub', async () => {
  // No session cookie rides along, so a GitHub read would fail rather than
  // return an empty diff.
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  const [result] = await readLines(response)

  expect(result).toMatchObject({diff: {summary: {added: 0, deleted: 0, modified: 0}}})
})

test('reads a public diff without a signed-in session', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/a.ts', type: 'change'}],
    }),
  )

  expect(response.status).not.toBe(401)
})

test('keeps entity diffs out of shared caches', async () => {
  const response = await handleEntityDiffRequest(
    createRequest({
      path: 'o/r/pull/1',
      files: [{itemId: 'item-1', name: 'src/moved.ts', type: 'rename-pure'}],
    }),
  )

  expect(response.headers.get('Cache-Control')).toContain('private')
  expect(response.headers.get('Vary')).toBe('Cookie')
})
