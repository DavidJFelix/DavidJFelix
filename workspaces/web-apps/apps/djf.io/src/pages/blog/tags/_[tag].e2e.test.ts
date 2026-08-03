import {expect, test} from '@playwright/test'

test('tag detail page filters posts by tag', async ({page}) => {
  await page.goto('/blog/tags/personal')

  await expect(page.getByRole('heading', {level: 1, name: /Posts tagged.*personal/})).toBeVisible()
  await expect(page.locator('article')).not.toHaveCount(0)
})
