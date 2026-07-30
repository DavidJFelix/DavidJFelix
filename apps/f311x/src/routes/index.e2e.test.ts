import {expect, test} from '@playwright/test'

// f311x is a single server-rendered chat page. These run against a local
// production boot (baseline authoring) or a deployed preview URL (CI) -- see
// playwright.config.ts. The route generator ignores *.test.ts (vite.config.ts),
// so this file co-locates with the route without becoming an endpoint.

test('home page renders the chat shell', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'f311x'})).toBeVisible()
  await expect(page.getByText('Start a conversation with the agent.')).toBeVisible()
  await expect(page.getByPlaceholder('Message the agent…')).toBeVisible()
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

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  // Wait for the server-rendered empty state and for web fonts to settle so the
  // snapshot is stable across runs.
  await expect(page.getByText('Start a conversation with the agent.')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
