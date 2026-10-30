import {processFile} from '@pierre/diffs'
import {expect, test, vi} from 'vitest'

import {createCodebergDiffFileLoader, createGitHubDiffFileLoader} from './diff-file-loader'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const PATCH =
  'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n'

function changedFile() {
  const fileDiff = processFile(PATCH, {isGitDiff: true})
  if (fileDiff === undefined) {
    throw new Error('The test patch did not parse.')
  }
  return fileDiff
}

// Answers like the file endpoint and records each URL the loader asked for.
function stubEndpoint() {
  const urls: string[] = []
  const fetcher = vi.fn<FetchLike>(async (input) => {
    urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    return Response.json({
      oldFile: {name: 'src/a.ts', contents: 'old\n'},
      newFile: {name: 'src/a.ts', contents: 'new\n'},
    })
  })
  return {fetcher, urls}
}

test.each([
  {name: 'a Codeberg pull request', path: '/acme/widgets/pulls/7'},
  {name: 'a Codeberg commit', path: '/acme/widgets/commit/83fea5e'},
])('loads files of $name from the Codeberg endpoint', async ({path}) => {
  const {fetcher, urls} = stubEndpoint()
  const loadDiffFiles = createCodebergDiffFileLoader(path, {fetch: fetcher})

  const files = await loadDiffFiles?.(changedFile())

  expect(files?.newFile?.contents).toBe('new\n')
  const url = new URL(urls[0] ?? '', 'https://revision.city')
  expect(url.pathname).toBe('/api/diffs/codeberg-diff-file')
  expect(url.searchParams.get('path')).toBe(path)
  expect(url.searchParams.get('name')).toBe('src/a.ts')
})

test.each([
  {name: 'a Codeberg compare', path: '/acme/widgets/compare/v1.0...v2.0'},
  {name: 'a GitHub pull request', path: '/acme/widgets/pull/7'},
])('has no Codeberg loader for $name', ({path}) => {
  expect(createCodebergDiffFileLoader(path)).toBeUndefined()
})

test('still loads GitHub files from the GitHub endpoint', async () => {
  const {fetcher, urls} = stubEndpoint()
  const loadDiffFiles = createGitHubDiffFileLoader('/acme/widgets/pull/7', {fetch: fetcher})

  await loadDiffFiles?.(changedFile())

  expect(urls[0]).toMatch(/^\/api\/diffs\/github-diff-file\?/)
})
