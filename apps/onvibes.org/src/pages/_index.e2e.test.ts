import {expect, test} from '@playwright/test'

// onvibes.org is a single static landing page (no dynamic content), so the
// visual baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. The `_`
// prefix keeps Astro from treating this file in src/pages/ as a route.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'Apps, built on vibes.'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Showcase'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Build'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
