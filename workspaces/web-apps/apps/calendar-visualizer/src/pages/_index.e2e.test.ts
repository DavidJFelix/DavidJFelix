import {expect, test} from '@playwright/test'

// calendar-visualizer is a single static page rendering a fixed 2025 calendar
// (deterministic -- no current-date dependency), so the visual baseline is
// stable. These run against a local production boot (baseline authoring) or a
// deployed preview URL (CI) -- see playwright.config.ts. The `_` prefix keeps
// Astro from treating this file in src/pages/ as a route.

test('home page renders the calendar', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'Calendar'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  // Let web fonts settle so the snapshot is stable across runs.
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
