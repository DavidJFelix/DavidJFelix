import {pngSize} from '@davidjfelix/og/png'
import type {Page} from '@playwright/test'
import {expect, test} from '@playwright/test'

// The plan config lives in URL search params, so the baseline pins every
// input (including `today`, which feasibility uses) — the render has no
// current-date dependency. These run against a local production boot
// (baseline authoring) or a deployed preview URL (CI) -- see
// playwright.config.ts. Lives outside src/routes/ so the TanStack route
// generator does not pick it up.

const PLAN_URL =
  '/?dist=marathon&race=2026-10-18&goal=4:30:00&wm=24&weeks=20&rd=fiveK&rt=25:00&today=2026-07-01'

// A preview build bakes its pr-<N> URL into the absolute tags (see
// .depot/actions/preview-wrangler); a local boot carries the canonical origin.
const origin = process.env.PREVIEW_URL
  ? new URL(process.env.PREVIEW_URL).origin
  : 'https://ravrun.com'

// The grid (desktop) and agenda (phones) both render race day; filter to
// whichever the current viewport shows.
const raceDay = (page: Page) => page.getByText('RACE! - 26.2').filter({visible: true})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto(PLAN_URL)
  // Wait for the SPA to hydrate (the race-week row renders) before snapshotting.
  await expect(raceDay(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {fullPage: true, maxDiffPixelRatio: 0.01})
})

// Phones swap the 7-column grid for the stacked agenda: the whole plan is
// readable with zero horizontal page overflow.
test('shows the agenda on a phone viewport without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto(PLAN_URL)
  await expect(raceDay(page)).toBeVisible()
  // Agenda day rows (with weekday + date labels) replace the grid.
  await expect(page.getByText('Sun 10/18').filter({visible: true})).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

test('home page carries OpenGraph meta and serves the card it points at', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const head = page.locator('head')
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'ravrun — training plan generator',
  )
  await expect(head.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/)
  // SPA mode prerenders one shell for every path, so an og:url/canonical here
  // would wrongly claim "/" for whatever page a scraper actually requested --
  // the root head omits both (src/routes/__root.tsx).
  await expect(head.locator('meta[property="og:url"]')).toHaveCount(0)
  await expect(head.locator('link[rel="canonical"]')).toHaveCount(0)
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
  // status and headers, no body.
  const probe = await request.head(cardPath)
  expect(probe.status()).toBe(200)
  expect(probe.headers()['content-type']).toContain('image/png')
  expect(probe.headers()['content-length']).toBe(String(png.byteLength))
  expect((await probe.body()).byteLength).toBe(0)
})

test('system dark is applied before first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

test('a persisted override beats the OS preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('the theme toggle cycles modes and persists the choice', async ({page}) => {
  await page.goto('/')
  // Fresh visit starts in system mode; the first press switches to light.
  await page.getByRole('button', {name: 'Switch to light theme'}).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.getByRole('button', {name: 'Switch to dark theme'}).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark')
  // The choice survives a reload via the pre-paint bootstrap.
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})
