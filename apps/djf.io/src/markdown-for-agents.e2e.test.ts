import {expect, test} from '@playwright/test'

// Markdown for Agents (src/lib/markdown-for-agents.ts, wired in src/worker.ts):
// `Accept: text/markdown` gets a markdown rendition of any page, everything
// else keeps getting HTML. Exercised against the built worker in workerd, so
// this also proves wrangler's run_worker_first routing hands page requests to
// the worker.

const MARKDOWN_ACCEPT = {accept: 'text/markdown'}

test('the home page serves markdown when the request asks for it', async ({request}) => {
  const response = await request.get('/', {headers: MARKDOWN_ACCEPT})
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('text/markdown; charset=utf-8')
  const body = await response.text()
  expect(response.headers()['x-markdown-tokens']).toBe(String(Math.ceil(body.length / 4)))
  // the asset response's ETag describes the HTML bytes and must not be reused
  expect(response.headers().etag).toBeUndefined()
  expect(body).toContain('title: "David J Felix | djf.io"')
  expect(body).not.toContain('<html')
})

test('blog posts serve their article as markdown without site chrome', async ({request}) => {
  const response = await request.get('/blog/2025-12-07-on-running/', {headers: MARKDOWN_ACCEPT})
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('text/markdown; charset=utf-8')
  const body = await response.text()
  expect(body).toContain('title: "On Running | djf.io"')
  expect(body).toContain('# On Running')
  // header, nav, and footer live outside <main> and must not leak in
  expect(body).not.toContain('©')
})

test('html stays the default for browsers', async ({request}) => {
  const browserAccept =
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
  // no explicit header sends Playwright's default */*; both must get HTML
  for (const headers of [undefined, {accept: browserAccept}]) {
    const response = await request.get('/', {headers})
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/html')
    expect(await response.text()).toContain('<!DOCTYPE html>')
  }
})

test('non-html responses ignore the markdown accept header', async ({request}) => {
  const response = await request.get('/rss.xml', {headers: MARKDOWN_ACCEPT})
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('xml')
  expect(await response.text()).toContain('<rss')
})

test('missing pages stay html 404s', async ({request}) => {
  const response = await request.get('/definitely-not-a-page/', {headers: MARKDOWN_ACCEPT})
  expect(response.status()).toBe(404)
  expect(response.headers()['content-type']).toContain('text/html')
})

test('static assets are served untouched', async ({request}) => {
  const response = await request.get('/favicon.svg', {headers: MARKDOWN_ACCEPT})
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg')
})
