import {expect, test} from '@playwright/test'

test('a blog post page renders MDX content and frontmatter', async ({page}) => {
  await page.goto('/blog')
  await page.getByRole('link', {name: 'On Running'}).click()

  await expect(page).toHaveURL(/\/blog\/2025-12-07-on-running\/?$/)
  await expect(page.getByRole('heading', {level: 1, name: 'On Running'})).toBeVisible()
  await expect(page.getByText(/running about four to five times a week/)).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Finding your pace'})).toBeVisible()
})
