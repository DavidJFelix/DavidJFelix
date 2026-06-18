import {expect, test} from '@playwright/test'
import {documentUri} from '../../lib/standard-site'

test('a blog post page renders MDX content and frontmatter', async ({page}) => {
  await page.goto('/blog')
  await page.getByRole('link', {name: 'On Running'}).click()

  await expect(page).toHaveURL(/\/blog\/2025-12-07-on-running\/?$/)
  await expect(page.getByRole('heading', {level: 1, name: 'On Running'})).toBeVisible()
  await expect(page.getByText(/running about four to five times a week/)).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Finding your pace'})).toBeVisible()
})

test('a blog post with a hero image in frontmatter displays it', async ({page}) => {
  await page.goto('/blog/2023-12-30-shipposting')

  const hero = page.getByRole('img', {
    name: /animated style illustration a software engineer/,
  })
  await expect(hero).toBeVisible()
  const naturalWidth = await hero.evaluate((img) => (img as HTMLImageElement).naturalWidth)
  expect(naturalWidth).toBeGreaterThan(0)
})

test('a blog post head carries its standard.site document link', async ({page}) => {
  await page.goto('/blog/2025-12-07-on-running')

  await expect(page.locator('link[rel="site.standard.document"]')).toHaveAttribute(
    'href',
    documentUri('2025-12-07-on-running'),
  )
})
