import {expect, type Page, test} from '@playwright/test'

// client:load islands attach their listeners only after React hydrates and
// flushes effects — interacting before then drops clicks and keystrokes on
// the floor. astro-island's ssr-attribute removal is not a safe signal (the
// React client hydrates inside startTransition and returns immediately), so
// the component sets data-hotkey-ready once its keydown listener is attached.
const gotoHydrated = async (page: Page, path: string) => {
  await page.goto(path)
  await expect(page.locator('button[data-hotkey-ready]')).toBeVisible()
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

test('search reports when nothing matches and recovers when the query changes', async ({page}) => {
  await gotoHydrated(page, '/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await dialog.getByRole('searchbox').fill('zebra')
  await expect(dialog.getByText(/No results for/)).toBeVisible()

  // editing the query withdraws the stale empty-state verdict
  await dialog.getByRole('searchbox').fill('shipposting')
  await expect(dialog.getByRole('link', {name: /Shipposting/}).first()).toBeVisible()
  await expect(dialog.getByText(/No results for/)).not.toBeVisible()
})

test('search works from a blog post page', async ({page}) => {
  await gotoHydrated(page, '/blog/2025-12-07-on-running/')

  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search posts'})
  await dialog.getByRole('searchbox').fill('positivity')
  await expect(dialog.getByRole('link', {name: /On Positivity/}).first()).toBeVisible()
})

test('shows the Ctrl key hint on non-Mac platforms', async ({page}) => {
  await gotoHydrated(page, '/')

  await expect(page.getByText('Ctrl K', {exact: true})).toBeVisible()
  await expect(page.getByText('⌘K', {exact: true})).toBeHidden()
})

test('shows the ⌘ key hint immediately on Mac, with no Ctrl→⌘ flash', async ({page}) => {
  // Both hints ship in the markup; CSS reveals one based on a data-platform
  // attribute an inline <head> script sets from navigator.platform before the
  // first paint. addInitScript runs before the page's own scripts, so forcing
  // a Mac platform exercises that branch — and because the choice is pre-paint
  // CSS rather than a post-hydration effect, ⌘K is the only glyph ever painted.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', {get: () => 'MacIntel'})
  })
  await gotoHydrated(page, '/')

  await expect(page.locator('html')).toHaveAttribute('data-platform', 'mac')
  await expect(page.getByText('⌘K', {exact: true})).toBeVisible()
  await expect(page.getByText('Ctrl K', {exact: true})).toBeHidden()
})
