import {expect, test} from '@playwright/test'

// forzamonica.com's home route `/` is a static hero (the Shopify/mock.shop
// product data lives on /products, not here), so its render is deterministic and
// the visual baseline is stable. These run against a local production boot
// (baseline authoring) or a deployed preview URL (CI) -- see playwright.config.ts.
// Lives outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the hero and shop chrome', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'Forza Monica'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Shop the collection'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Cart'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
