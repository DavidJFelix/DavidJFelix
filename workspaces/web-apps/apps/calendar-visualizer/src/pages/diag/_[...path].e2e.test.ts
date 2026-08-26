import {expect, test} from '@playwright/test'

// The /diag reverse proxy can only reach PostHog from a real Cloudflare deploy,
// so these run against the per-PR preview (PREVIEW_URL set) -- not the local
// `wrangler dev` boot, whose workerd can't egress to PostHog. They exercise the
// backend per the repo's runtime-gate rule, and need no PostHog key (the proxy is
// key-agnostic; the key only gates the client snippet).
const previewOnly =
  'needs the deployed preview; the proxy upstream is unreachable from a local boot'

test('/diag serves the PostHog Web SDK through the assets host', async ({request}) => {
  test.skip(!process.env.PREVIEW_URL, previewOnly)
  // when
  const response = await request.get('/diag/static/array.js')
  const status = response.ok()
  const contentTypeHeader = response.headers()['content-type']

  // then
  expect(status).toBe(true)
  expect(contentTypeHeader).toBeDefined()
  expect(contentTypeHeader).toContain('javascript')
})

test('/diag forwards API requests to the ingestion host', async ({request}) => {
  test.skip(!process.env.PREVIEW_URL, previewOnly)
  // when
  const response = await request.get('/diag/flags/?v=2')
  const status = response.ok()
  const contentTypeHeader = response.headers()['content-type']

  // then
  expect(status).toBe(true)
  expect(contentTypeHeader).toBeDefined()
  expect(contentTypeHeader).toContain('json')
})
