// cSpell:ignore unstub -- vi.unstubAllEnvs
import {expect, test, vi} from 'vitest'

import {clearGitHubDiffFileServerCache, loadGitHubDiffFiles} from './github-diff-file-server'

// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const SOURCE = '/owner/repo/pull/7'

// Answers ref resolution and file reads so a request can run to completion.
function stubGitHub() {
  return vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/pulls/7')) {
      return Response.json({
        base: {sha: 'base-sha', repo: {full_name: 'owner/repo'}},
        head: {sha: 'head-sha', repo: {full_name: 'owner/repo'}},
      })
    }
    if (url.includes('/compare/')) {
      return Response.json({merge_base_commit: {sha: 'merge-base-sha'}})
    }
    return new Response('export function greet() {}\n')
  })
}

function authorizationHeaders(fetcher: ReturnType<typeof stubGitHub>): (string | null)[] {
  return fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('authorization'))
}

test('an anonymous read sends no credential even when a server token is configured', async () => {
  clearGitHubDiffFileServerCache()
  vi.stubEnv('DIFFSHUB_GITHUB_TOKEN', 'server-token-with-private-access')
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles(
    {name: 'src/a.ts', path: SOURCE, type: 'change'},
    {fetch: fetcher, tokenSource: 'anonymous'},
  )

  // Falling back to the server token here would hand every unauthenticated
  // visitor its reach, and cache private content where all of them share it.
  expect(authorizationHeaders(fetcher)).not.toContain('Bearer server-token-with-private-access')
  expect(authorizationHeaders(fetcher).every((header) => header === null)).toBe(true)
  vi.unstubAllEnvs()
})

// Pairs with the test above: without this, that one would still pass if the
// stubbed env never reached the code, proving nothing about the guard.
test('a read with no token source does fall back to the server token', async () => {
  clearGitHubDiffFileServerCache()
  vi.stubEnv('DIFFSHUB_GITHUB_TOKEN', 'server-token-with-private-access')
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles({name: 'src/a.ts', path: SOURCE, type: 'change'}, {fetch: fetcher})

  expect(authorizationHeaders(fetcher)).toContain('Bearer server-token-with-private-access')
  vi.unstubAllEnvs()
})

test("a signed-in read carries the caller's own token", async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  await loadGitHubDiffFiles(
    {name: 'src/a.ts', path: SOURCE, type: 'change'},
    {fetch: fetcher, token: 'user-token', tokenSource: 'request'},
  )

  expect(authorizationHeaders(fetcher)).toContain('Bearer user-token')
})

test('hydrates an added file only when asked, so the viewer keeps its placeholder', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const placeholder = await loadGitHubDiffFiles(
    {name: 'src/new.ts', path: SOURCE, type: 'new'},
    {fetch: fetcher, tokenSource: 'anonymous'},
  )

  expect(placeholder.newFile?.contents).toBe('')
  expect(fetcher).not.toHaveBeenCalled()

  const hydrated = await loadGitHubDiffFiles(
    {name: 'src/new.ts', path: SOURCE, type: 'new'},
    {fetch: fetcher, tokenSource: 'anonymous', hydrateSingleSided: true},
  )

  expect(hydrated.newFile?.contents).toContain('greet')
  expect(hydrated.oldFile).toBeNull()
})

test('hydrates a deleted file from the base revision', async () => {
  clearGitHubDiffFileServerCache()
  const fetcher = stubGitHub()

  const {oldFile, newFile} = await loadGitHubDiffFiles(
    {name: 'src/gone.ts', path: SOURCE, type: 'deleted'},
    {fetch: fetcher, tokenSource: 'anonymous', hydrateSingleSided: true},
  )

  expect(oldFile?.contents).toContain('greet')
  expect(newFile).toBeNull()
})
