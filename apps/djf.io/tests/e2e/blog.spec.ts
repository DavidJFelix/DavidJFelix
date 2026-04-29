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

test('a blog post page renders MDX content and frontmatter', async ({page}) => {
  await page.goto('/blog')
  await page.getByRole('link', {name: 'On Running'}).click()

  await expect(page).toHaveURL(/\/blog\/2025-12-07-on-running\/?$/)
  await expect(page.getByRole('heading', {level: 1, name: 'On Running'})).toBeVisible()
  await expect(page.getByText(/running about four to five times a week/)).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Finding your pace'})).toBeVisible()
})

test('tags index lists tags from posts', async ({page}) => {
  await page.goto('/blog/tags')

  await expect(page.getByRole('heading', {level: 1, name: 'Tags'})).toBeVisible()
  await expect(page.getByRole('link', {name: /personal/})).toBeVisible()
})

test('tag detail page filters posts by tag', async ({page}) => {
  await page.goto('/blog/tags/personal')

  await expect(page.getByRole('heading', {level: 1, name: /Posts tagged.*personal/})).toBeVisible()
  await expect(page.locator('article')).not.toHaveCount(0)
})
