import {expect, test} from '@playwright/test'

// Below Panda's md breakpoint (768px) the nav links collapse behind a
// hamburger; this suite pins a phone-sized viewport. getByRole only matches
// elements exposed to the accessibility tree, so hidden links resolve to a
// count of 0 rather than an invisible match.
test.use({viewport: {width: 390, height: 844}})

test('mobile home page has no horizontal overflow', async ({page}) => {
  await page.goto('/')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

test('mobile nav collapses the links behind a hamburger', async ({page}) => {
  await page.goto('/')

  await expect(page.getByRole('button', {name: 'Open menu'})).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', {name: 'About'})).toHaveCount(0)
})

test('the hamburger opens the menu and its links navigate', async ({page}) => {
  await page.goto('/')

  await page.getByRole('button', {name: 'Open menu'}).click()
  await page.getByRole('navigation').getByRole('link', {name: 'About'}).click()
  await expect(page).toHaveURL(/\/about\/?$/)
})

test('escape closes the open menu', async ({page}) => {
  await page.goto('/')

  await page.getByRole('button', {name: 'Open menu'}).click()
  await expect(page.getByRole('navigation').getByRole('link', {name: 'About'})).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation').getByRole('link', {name: 'About'})).toHaveCount(0)
  await expect(page.getByRole('button', {name: 'Open menu'})).toBeVisible()
})

test('the hamburger is gone at desktop widths and inline links return', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto('/')

  await expect(page.getByRole('button', {name: 'Open menu'})).toHaveCount(0)
  await expect(page.getByRole('navigation').getByRole('link', {name: 'About'})).toBeVisible()
})
