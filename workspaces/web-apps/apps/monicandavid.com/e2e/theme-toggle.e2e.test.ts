import {expect, test} from '@playwright/test'

// Shared theme-switcher contract (docs/projects/theme-switcher-unification/plan.md):
// mode-watcher's injected head script must apply the resolved scheme before
// first paint (no flash), a persisted override must beat the OS preference,
// and the toggle must cycle + persist across reloads. Lives in e2e/ (outside
// src/routes/) so neither SvelteKit nor Vitest picks it up.

test('system dark preference is honored before interaction', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveClass('dark')
  await expect(html).toHaveCSS('color-scheme', 'dark')
})

test('a persisted light override beats a dark OS preference', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light')
  })
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass('light')
})

test('clicking the toggle flips the mode and persists across reload', async ({page}) => {
  // Start from the default (no persisted "theme" key) with a light OS
  // preference, so the raw mode is "system" and the first click -- which
  // cycles system -> light -- doesn't itself flip the resolved class. The
  // second click (light -> dark) does; asserting on two clicks avoids seeding
  // localStorage via addInitScript, which would re-run (and clobber the
  // click's persisted value) on the reload below.
  await page.emulateMedia({colorScheme: 'light'})
  await page.goto('/')
  const html = page.locator('html')
  const toggle = page.getByRole('button', {name: /Switch to .* theme/u})
  await expect(html).toHaveClass('light')

  await toggle.click()
  await toggle.click()
  await expect(html).toHaveClass('dark')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')

  await page.reload()
  await expect(html).toHaveClass('dark')
})
