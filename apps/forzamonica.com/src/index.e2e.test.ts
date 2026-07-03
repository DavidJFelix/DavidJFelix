import {expect, test} from '@playwright/test'

// forzamonica.com's static-page suite: the home hero, the shared chrome, and
// the sitemap pages that render without Shopify/mock.shop data (about,
// policies, 404). Product data lives on /products, not here, so these renders
// are deterministic and the visual baseline is stable. They run against a
// local production boot (baseline authoring) or a deployed preview URL (CI)
// -- see playwright.config.ts.
// Lives outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the hero and shop chrome', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'Forza Monica'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Shop the collection'})).toBeVisible()
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', {name: 'Shop'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'About'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'Cart'})).toBeVisible()
})

test('footer links the sitemap', async ({page}) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', {name: 'All products'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'About'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Shipping'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Returns'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Privacy'})).toBeVisible()
  await expect(footer.getByText('© 2026 Forza Monica')).toBeVisible()
})

test('about page renders the placeholder story', async ({page}) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', {level: 1, name: 'About Forza Monica'})).toBeVisible()
  await expect(page).toHaveTitle('About — Forza Monica')
})

test('policy pages render their stubs', async ({page}) => {
  await page.goto('/policies/shipping')
  await expect(page.getByRole('heading', {level: 1, name: 'Shipping policy'})).toBeVisible()
  await page.goto('/policies/returns')
  await expect(page.getByRole('heading', {level: 1, name: 'Returns policy'})).toBeVisible()
  await page.goto('/policies/privacy')
  await expect(page.getByRole('heading', {level: 1, name: 'Privacy policy'})).toBeVisible()
})

test('unknown paths get the styled 404 inside the shop chrome', async ({page}) => {
  const response = await page.goto('/definitely-not-a-page')
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', {level: 1, name: 'This page took a wrong turn'}),
  ).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', {name: 'Shop'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
