import {expect, test} from '@playwright/test'

test('blog index lists posts in reverse-chronological order', async ({page}) => {
  await page.goto('/blog')

  await expect(page.getByRole('heading', {level: 1, name: 'Blog'})).toBeVisible()

  const articles = page.locator('article')
  const count = await articles.count()
  expect(count).toBeGreaterThanOrEqual(3)

  const firstTitle = await articles.first().getByRole('heading', {level: 2}).textContent()
  expect(firstTitle?.trim()).toBe('On Running')
})

test('the whole card is a click target, not just the title', async ({page}) => {
  await page.goto('/blog')

  // Click the card body itself; the title link's overlay receives it.
  await page.locator('article').first().click()
  await expect(page).toHaveURL(/\/blog\/2025-12-07-on-running\/?$/)
})

test('tag chips inside a card win over the card link', async ({page}) => {
  await page.goto('/blog')

  await page.locator('article').first().getByRole('link', {name: 'vibes', exact: true}).click()
  await expect(page).toHaveURL(/\/blog\/tags\/vibes\/?$/)
})
