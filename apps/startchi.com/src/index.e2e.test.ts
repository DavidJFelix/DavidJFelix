import {expect, test} from '@playwright/test'

// startchi.com is a single SSR landing page (no dynamic content), so the visual
// baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. Lives
// outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', {level: 1, name: 'The Midwest startup ecosystem.'}),
  ).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Directory'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Identity'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
