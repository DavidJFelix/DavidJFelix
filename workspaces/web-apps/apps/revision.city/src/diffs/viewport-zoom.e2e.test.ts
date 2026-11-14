import {expect, test} from '@playwright/test'

// The /diffs route replaces the root viewport tag. It must not lock the
// scale, so people can pinch zoom a diff.
test('a diffs page has one viewport tag and it lets people zoom', async ({page}) => {
  await page.goto('/diffs')
  const viewport = page.locator('head meta[name="viewport"]')
  await expect(viewport).toHaveCount(1)
  await expect(viewport).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1, viewport-fit=cover',
  )
})
