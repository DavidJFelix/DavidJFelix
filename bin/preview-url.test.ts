import {expect, test} from 'bun:test'
import {previewUrl, resolveSubdomain} from './preview-url'
import {parsePreviewUrl} from './upload-preview'

// The fixtures' workers.dev subdomain is an identifier. cSpell:ignore felixdj

test('builds the deterministic alias URL from the pr number, worker name, and subdomain', () => {
  expect(previewUrl({prNumber: '42', workerName: 'startchi-com', subdomain: 'felixdj'})).toBe(
    'https://pr-42-startchi-com.felixdj.workers.dev/',
  )
})

test('agrees with the URL upload-preview.ts derives from wrangler output after the upload', () => {
  // The build bakes the pre-resolved URL in and the e2e run receives the
  // post-upload one; both must be the same string for the tags to match.
  const stdout = 'Version Preview URL: https://deadbeef-startchi-com.felixdj.workers.dev\n'
  expect(previewUrl({prNumber: '42', workerName: 'startchi-com', subdomain: 'felixdj'})).toBe(
    parsePreviewUrl(stdout, {prNumber: '42', workerName: 'startchi-com'}),
  )
})

test('reads the subdomain from the Cloudflare API with the bearer token', async () => {
  const calls: Array<{url: string; headers: unknown}> = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), headers: init?.headers})
    return Response.json({success: true, result: {subdomain: 'felixdj'}})
  }) as typeof fetch
  expect(await resolveSubdomain({accountId: 'acct', apiToken: 'tok', fetch: fetchImpl})).toBe(
    'felixdj',
  )
  expect(calls).toEqual([
    {
      url: 'https://api.cloudflare.com/client/v4/accounts/acct/workers/subdomain',
      headers: {authorization: 'Bearer tok'},
    },
  ])
})

test('rejects an unsuccessful API response with its status and errors', async () => {
  const fetchImpl = (async () =>
    Response.json(
      {success: false, errors: [{code: 10000, message: 'Authentication error'}]},
      {status: 403},
    )) as typeof fetch
  await expect(
    resolveSubdomain({accountId: 'acct', apiToken: 'tok', fetch: fetchImpl}),
  ).rejects.toThrow('HTTP 403')
})

test('rejects a successful response that carries no subdomain', async () => {
  // An account with workers.dev disabled answers success with a null result.
  const fetchImpl = (async () => Response.json({success: true, result: null})) as typeof fetch
  await expect(
    resolveSubdomain({accountId: 'acct', apiToken: 'tok', fetch: fetchImpl}),
  ).rejects.toThrow('HTTP 200')
})
