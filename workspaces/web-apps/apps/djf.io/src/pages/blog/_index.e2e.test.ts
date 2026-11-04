import {expect, test} from '@playwright/test'

test('blog index lists posts in reverse-chronological order', async ({page}) => {
  await page.goto('/blog')

  await expect(page.getByRole('heading', {level: 1, name: 'Blog'})).toBeVisible()

  const titles = (
    await page.locator('article').getByRole('heading', {level: 2}).allTextContents()
  ).map((title) => title.trim())
  expect(titles.length).toBeGreaterThanOrEqual(3)

  // Compare fixed posts by relative order, so a new post at the top does not break the test.
  const running = titles.indexOf('On Running')
  const positivity = titles.indexOf('On Positivity')
  const shipposting = titles.indexOf('Shipposting')
  expect(running).toBeGreaterThanOrEqual(0)
  expect(running).toBeLessThan(positivity)
  expect(positivity).toBeLessThan(shipposting)
})

test('the whole card is a click target, not just the title', async ({page}) => {
  await page.goto('/blog')

  // Click the card body itself; the title link's overlay receives it.
  await page.locator('article', {hasText: 'On Running'}).click()
  await expect(page).toHaveURL(/\/blog\/2025-12-07-on-running\/?$/)
})

test('tag chips inside a card win over the card link', async ({page}) => {
  await page.goto('/blog')

  await page
    .locator('article', {hasText: 'On Running'})
    .getByRole('link', {name: 'vibes', exact: true})
    .click()
  await expect(page).toHaveURL(/\/blog\/tags\/vibes\/?$/)
})
