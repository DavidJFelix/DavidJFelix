import {expect, test} from '@playwright/test'

// Exercises the repo-wide theme-switcher contract
// (docs/projects/theme-switcher-unification/plan.md): tri-state light/dark/
// system via @nuxtjs/color-mode, localStorage key 'theme', pre-paint class on
// <html>, color-scheme tracking, and a real toggle button. Lives beside
// home.e2e.test.ts in e2e/ so neither Nuxt nor Vitest picks it up.

test('system dark preference is honored at first load', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass('dark')
  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  )
  expect(colorScheme).toBe('dark')
})

test('a persisted override beats the OS preference', async ({page}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass('light')
})

test('clicking the toggle flips the theme and persists across reload', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass('dark')

  // Pre-hydration the button reads "Toggle color theme"; this locator only
  // matches once @nuxtjs/color-mode's app:mounted hook resolves the raw mode
  // and the label becomes concrete -- Playwright's locator re-queries on
  // click, so no manual wait is needed.
  const toggle = page.getByRole('button', {name: /Switch to .* theme/u})
  await toggle.click()

  await expect(page.locator('html')).toHaveClass('light')
  const stored = await page.evaluate(() => window.localStorage.getItem('theme'))
  expect(stored).toBe('light')

  await page.reload()
  await expect(page.locator('html')).toHaveClass('light')
  await expect(page.getByRole('button', {name: 'Switch to dark theme'})).toBeVisible()
})
