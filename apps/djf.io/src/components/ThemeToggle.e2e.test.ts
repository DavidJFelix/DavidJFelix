import {expect, test} from '@playwright/test'

// Co-located with ThemeToggle.astro (not under src/pages/, so no underscore
// prefix -- same placement convention as Search.e2e.test.ts). The bootstrap
// script and toggle mount on every page via BaseLayout, so any route works;
// these run against the home page like the other suites here.

test('system dark is honored at first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

test('a persisted light override beats a dark OS preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('the toggle cycles light -> dark -> system, persisting the choice across reload', async ({
  page,
}) => {
  await page.goto('/')
  const toggle = page.locator('#theme-toggle')

  // Fresh visit starts in system mode; the label announces the next mode.
  await expect(toggle).toHaveAttribute('aria-label', /^Switch to (light|dark|system) theme$/)

  await toggle.click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme')
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('light')

  await toggle.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to system theme')
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to light theme')
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('system')

  // The choice (system) survives a reload via the pre-paint bootstrap.
  await page.reload()
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('system')
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to light theme')
})

test('system mode tracks a live OS preference change without reload', async ({page}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system')
  await expect(page.locator('html')).toHaveClass(/light/)

  await page.emulateMedia({colorScheme: 'dark'})
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})
