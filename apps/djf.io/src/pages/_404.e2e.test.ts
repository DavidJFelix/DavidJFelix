import {expect, test} from '@playwright/test'

test('unknown routes serve the 404 page with a 404 status', async ({page}) => {
  const response = await page.goto('/this-route-does-not-exist')

  expect(response?.status()).toBe(404)
  await expect(page).toHaveTitle(/Page not found \| djf\.io/)
  await expect(page.getByRole('heading', {level: 1, name: 'Page not found'})).toBeVisible()
})

test('the 404 page links back home', async ({page}) => {
  await page.goto('/this-route-does-not-exist')

  const homeLink = page.getByRole('link', {name: /back home/i})
  await expect(homeLink).toBeVisible()
  await homeLink.click()
  await expect(page).toHaveURL(/\/$/)
})
