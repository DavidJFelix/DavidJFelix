import {pngSize} from '@davidjfelix/og/png'
import {expect, test} from '@playwright/test'

// davidjfelix.com is a single static landing page (no dynamic content), so the
// visual baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. The `_`
// prefix keeps Astro from treating this file in src/pages/ as a route.

// A preview build bakes its pr-<N> URL into the absolute tags (see
// .depot/actions/preview-wrangler); a local boot carries the canonical origin.
const origin = process.env.PREVIEW_URL
  ? new URL(process.env.PREVIEW_URL).origin
  : 'https://davidjfelix.com'

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'David J. Felix'})).toBeVisible()
})

test('home page carries OpenGraph meta and serves the card it points at', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const head = page.locator('head')
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'David J. Felix',
  )
  await expect(head.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/)
  await expect(head.locator('meta[property="og:url"]')).toHaveAttribute('content', `${origin}/`)
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/`)
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )
  const image = await head.locator('meta[property="og:image"]').getAttribute('content')
  expect(image).toBe(`${origin}/og/default.png`)
  // The card renders on the worker at request time; fetch it from this boot.
  const cardPath = new URL(image as string).pathname
  const response = await request.get(cardPath)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')
  const png = await response.body()
  expect(pngSize(png)).toEqual({width: 1200, height: 630})
  // Scrapers and CDNs probe the image with HEAD before fetching it: GET's
  // status and headers, no body. Astro hands a HEAD to the endpoint's GET
  // export, which is the og handler, so the handler builds the HEAD response
  // and its Content-Length reaches the wire (verified on the workerd boot and
  // on the deployed preview), unlike Nuxt's bridge, which strips it.
  const probe = await request.head(cardPath)
  expect(probe.status()).toBe(200)
  expect(probe.headers()['content-type']).toContain('image/png')
  expect(probe.headers()['content-length']).toBe(String(png.byteLength))
  expect((await probe.body()).byteLength).toBe(0)
})

test('system dark is applied before first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/u)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

test('a persisted override beats the OS preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/light/u)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('the theme toggle cycles modes and persists the choice', async ({page}) => {
  await page.goto('/')
  // Fresh visit starts in system mode; the first press switches to light.
  await page.getByRole('button', {name: 'Switch to light theme'}).click()
  await expect(page.locator('html')).toHaveClass(/light/u)
  await page.getByRole('button', {name: 'Switch to dark theme'}).click()
  await expect(page.locator('html')).toHaveClass(/dark/u)
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark')
  // The choice survives a reload via the pre-paint bootstrap.
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/u)
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
