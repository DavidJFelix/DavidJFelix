import {expect, test} from '@playwright/test'

// The /ingest reverse proxy can only reach PostHog from a real Cloudflare deploy,
// so these run against the per-PR preview (PREVIEW_URL set) -- not the local
// `astro preview` boot, whose workerd can't egress to PostHog. They exercise the
// backend per the repo's runtime-gate rule, and need no PostHog key (the proxy is
// key-agnostic; the key only gates the client snippet).
const previewOnly =
  'needs the deployed preview; the proxy upstream is unreachable from a local boot'

test('/ingest serves the PostHog Web SDK through the assets host', async ({request}) => {
  test.skip(!process.env.PREVIEW_URL, previewOnly)
  const response = await request.get('/ingest/static/array.js')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type'] ?? '').toContain('javascript')
})

test('/ingest forwards API requests to the ingestion host', async ({request}) => {
  test.skip(!process.env.PREVIEW_URL, previewOnly)
  const response = await request.get('/ingest/flags/?v=2')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type'] ?? '').toContain('json')
})
