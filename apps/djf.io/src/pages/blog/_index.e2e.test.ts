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
