import {expect, test} from '@playwright/test'

// forzamonica.com's e2e suite: the gallery home, the shared chrome, and the
// pages that render without Shopify/mock.shop data (commissions, about,
// policies, 404). The home hero and chrome are static, but the gallery grid
// below them comes from mock.shop, so the visual baseline lives on the
// commissions page instead -- fully static, and it exercises the design
// system's type, form controls, and card surfaces. They run against a local
// production boot (baseline authoring) or a deployed preview URL (CI)
// -- see playwright.config.ts.
// Lives outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the gallery hero and shop chrome', async ({page}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', {level: 1, name: 'Little paintings, made slowly'}),
  ).toBeVisible()
  const filters = page.getByRole('navigation', {name: 'Filter the gallery'})
  await expect(filters.getByRole('link', {name: 'All'})).toBeVisible()
  await expect(filters.getByRole('link', {name: 'Print'})).toBeVisible()
  await expect(filters.getByRole('link', {name: 'Original'})).toBeVisible()
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', {name: 'Shop'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'Originals'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'Commissions'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'About'})).toBeVisible()
  await expect(header.getByRole('link', {name: 'Cart'})).toBeVisible()
})

test('old catalog url redirects to the gallery home', async ({page}) => {
  await page.goto('/products')
  await expect(
    page.getByRole('heading', {level: 1, name: 'Little paintings, made slowly'}),
  ).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
})

test('footer links the sitemap', async ({page}) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', {name: 'Prints'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Originals'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Commissions'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'About Monica'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Shipping'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Returns'})).toBeVisible()
  await expect(footer.getByRole('link', {name: 'Privacy'})).toBeVisible()
  await expect(
    footer.getByText('© 2026 forzamonica art · Watercolors by Monica Felix'),
  ).toBeVisible()
})

test("about page renders Monica's story", async ({page}) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', {level: 1, name: "Hi, I'm Monica"})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Ask about a commission'})).toBeVisible()
  await expect(page).toHaveTitle('About — forzamonica art')
})

test('commissions page renders the form and how-it-works', async ({page}) => {
  await page.goto('/commissions')
  await expect(page.getByRole('heading', {level: 1, name: "Let's paint your idea"})).toBeVisible()
  await expect(page.getByLabel('Your name')).toBeVisible()
  await expect(page.getByLabel('Email', {exact: true})).toBeVisible()
  await expect(page.getByLabel('Tell me about your idea')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Send to Monica'})).toBeVisible()
  await expect(page.getByText('I sketch and quote')).toBeVisible()
  await expect(page).toHaveTitle('Commissions — forzamonica art')
})

// One test per page: each navigation pays a cold fetch of the webfont
// stylesheet, so back-to-back page loads can overrun a single test budget.
for (const [path, heading] of [
  ['/policies/shipping', 'Shipping policy'],
  ['/policies/returns', 'Returns policy'],
  ['/policies/privacy', 'Privacy policy'],
] as const) {
  test(`${heading} page renders its stub`, async ({page}) => {
    await page.goto(path)
    await expect(page.getByRole('heading', {level: 1, name: heading})).toBeVisible()
  })
}

test('unknown paths get the styled 404 inside the shop chrome', async ({page}) => {
  const response = await page.goto('/definitely-not-a-page')
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', {level: 1, name: 'This page took a wrong turn'}),
  ).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', {name: 'Shop'})).toBeVisible()
})

test('commissions page matches the visual baseline', async ({page}) => {
  await page.goto('/commissions')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('commissions.png', {maxDiffPixelRatio: 0.01})
})
