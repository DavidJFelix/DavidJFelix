import {expect, test} from '@playwright/test'

test('home page renders heading and tagline', async ({page}) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/David J Felix \| djf\.io/)
  await expect(page.getByRole('heading', {level: 1, name: 'David J Felix'})).toBeVisible()
  await expect(page.getByText("It's all downhill from here")).toBeVisible()
})

test('home page links to blog', async ({page}) => {
  await page.goto('/')

  const blogLink = page.getByRole('link', {name: /^blog$/i}).first()
  await expect(blogLink).toBeVisible()
  await blogLink.click()
  await expect(page).toHaveURL(/\/blog\/?$/)
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1, name: 'David J Felix'})).toBeVisible()
  // Let web fonts settle so the snapshot is stable across runs.
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
