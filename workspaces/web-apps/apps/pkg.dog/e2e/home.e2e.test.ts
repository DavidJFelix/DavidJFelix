import {expect, test} from '@playwright/test'

// pkg.dog is a single SSR landing page (no dynamic content), so the visual
// baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. Lives
// in e2e/ so neither Nuxt nor Vitest treats it as a source file.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'Only the parts you use.'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Ignore the noise'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Upgrade types safely'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
