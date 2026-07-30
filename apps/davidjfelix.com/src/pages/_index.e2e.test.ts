import {expect, test} from '@playwright/test'

// davidjfelix.com is a single static landing page (no dynamic content), so the
// visual baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. The `_`
// prefix keeps Astro from treating this file in src/pages/ as a route.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'David J. Felix'})).toBeVisible()
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
