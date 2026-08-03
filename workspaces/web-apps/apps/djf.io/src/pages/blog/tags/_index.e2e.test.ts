import {expect, test} from '@playwright/test'

test('tags index lists tags from posts', async ({page}) => {
  await page.goto('/blog/tags')

  await expect(page.getByRole('heading', {level: 1, name: 'Tags'})).toBeVisible()
  await expect(page.getByRole('link', {name: /personal/})).toBeVisible()
})
