import {expect, test, vi} from 'vitest'

import {handleCodebergDiffFileRequest} from './codeberg-diff-file-endpoint'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const API = 'https://codeberg.org/api/v1/repos/acme/widgets'

function fileRequest(search: string): Request {
  return new Request(`https://revision.city/api/diffs/codeberg-diff-file?${search}`)
}

function stubCodeberg() {
  return vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === `${API}/git/commits/83fea5e`) {
      return Response.json({sha: 'commit-sha', parents: [{sha: 'parent-sha'}]})
    }
    return new Response(url.includes('ref=parent-sha') ? 'old\n' : 'new\n')
  })
}

test('answers with both sides of a changed file', async () => {
  const response = await handleCodebergDiffFileRequest(
    fileRequest('path=/acme/widgets/commit/83fea5e&type=change&name=README.md'),
    {fetch: stubCodeberg()},
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toMatchObject({
    oldFile: {contents: 'old\n'},
    newFile: {contents: 'new\n'},
  })
})

test.each([
  {name: 'no path', search: 'type=change&name=README.md'},
  {name: 'no name', search: 'path=/acme/widgets/commit/83fea5e&type=change'},
  {name: 'an unknown type', search: 'path=/acme/widgets/commit/83fea5e&type=moved&name=README.md'},
])('rejects a request with $name without a fetch', async ({search}) => {
  const fetcher = stubCodeberg()

  const response = await handleCodebergDiffFileRequest(fileRequest(search), {fetch: fetcher})

  expect(response.status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

test('answers 502 with the reason when Codeberg fails', async () => {
  const response = await handleCodebergDiffFileRequest(
    fileRequest('path=/acme/widgets/pulls/7&type=change&name=README.md'),
    {fetch: vi.fn<FetchLike>(async () => new Response('', {status: 404}))},
  )

  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({error: 'Codeberg pull acme/widgets#7 failed (404).'})
})
