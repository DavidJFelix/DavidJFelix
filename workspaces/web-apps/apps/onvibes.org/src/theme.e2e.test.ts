import {expect, test} from '@playwright/test'

// Exercises the theme contract (docs/projects/theme-switcher-unification/plan.md)
// against the home page: pre-paint OS resolution, a persisted override beating
// the OS, and the toggle cycling + persisting each mode.

test('system dark is honored at first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveClass(/dark/u)
  await expect(html).toHaveAttribute('data-theme-mode', 'system')
  expect(await html.evaluate((el) => el.style.colorScheme)).toBe('dark')
})

test('system light is honored at first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'})
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveClass(/light/u)
  await expect(html).toHaveAttribute('data-theme-mode', 'system')
  expect(await html.evaluate((el) => el.style.colorScheme)).toBe('light')
})

test('a persisted override beats the OS preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveClass(/light/u)
  await expect(html).toHaveAttribute('data-theme-mode', 'light')
  expect(await html.evaluate((el) => el.style.colorScheme)).toBe('light')
})

test('the toggle cycles light -> dark -> system and persists each choice', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'})
  await page.goto('/')
  const html = page.locator('html')
  const toggle = page.getByRole('button', {name: /switch to/iu})

  await expect(html).toHaveAttribute('data-theme-mode', 'system')

  await toggle.click()
  await expect(html).toHaveAttribute('data-theme-mode', 'light')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme')

  await toggle.click()
  await expect(html).toHaveAttribute('data-theme-mode', 'dark')
  await expect(html).toHaveClass(/dark/u)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to system theme')

  await toggle.click()
  await expect(html).toHaveAttribute('data-theme-mode', 'system')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to light theme')
})
