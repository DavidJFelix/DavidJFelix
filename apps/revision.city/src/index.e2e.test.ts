import {expect, test} from '@playwright/test'

// revision.city is a single SSR landing page (no dynamic content), so the visual
// baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. Lives
// outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', {level: 1, name: 'Version control, centered on review.'}),
  ).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Reviews'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Diffs'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})

// The mark is declared once on the root route, and lives in public/ rather than
// the module graph -- so what is worth proving is that child routes inherit the
// link and that the build actually ships the file behind it.
for (const path of ['/', '/diffs']) {
  test(`${path} links the favicon`, async ({page}) => {
    await page.goto(path)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  })
}

test('favicon is served as an svg', async ({request}) => {
  const response = await request.get('/favicon.svg')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  // Really the SVG, rather than the SPA fallback document a build that dropped
  // public/ would answer an unknown path with.
  expect(await response.text()).toContain('<svg')
})
