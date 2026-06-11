import {expect, type Page, test} from '@playwright/test'

// client:load islands attach their event listeners only after hydration, and
// astro-island removes its ssr attribute once that completes — interacting
// before then drops clicks and keystrokes on the floor.
const gotoHydrated = async (page: Page, path: string) => {
  await page.goto(path)
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0)
}

test('nav search button opens the dialog and finds a post by title', async ({page}) => {
  await gotoHydrated(page, '/')

  await page.getByRole('button', {name: 'Search'}).click()
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await expect(dialog).toBeVisible()

  await dialog.getByRole('searchbox').fill('shipposting')
  const result = dialog.getByRole('link', {name: /Shipposting/}).first()
  await expect(result).toBeVisible()

  await result.click()
  await expect(page).toHaveURL(/\/blog\/2023-12-30-shipposting\/$/)
})

test('cmd/ctrl+k opens search and finds a post by body text', async ({page}) => {
  await gotoHydrated(page, '/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await expect(dialog).toBeVisible()

  // "Kubernetes" appears only in the body of On Positivity, not its title
  await dialog.getByRole('searchbox').fill('Kubernetes')
  await expect(dialog.getByRole('link', {name: /On Positivity/}).first()).toBeVisible()
})

test('escape closes the search dialog', async ({page}) => {
  await gotoHydrated(page, '/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('search reports when nothing matches', async ({page}) => {
  await gotoHydrated(page, '/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await dialog.getByRole('searchbox').fill('zebra')
  await expect(dialog.getByText(/No results for/)).toBeVisible()
})

test('search works from a blog post page', async ({page}) => {
  await gotoHydrated(page, '/blog/2025-12-07-on-running/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await dialog.getByRole('searchbox').fill('positivity')
  await expect(dialog.getByRole('link', {name: /On Positivity/}).first()).toBeVisible()
})
