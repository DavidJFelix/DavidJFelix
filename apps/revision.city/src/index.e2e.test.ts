import {expect, type Page, test} from '@playwright/test'

// revision.city is a single SSR landing page (no dynamic content), so the visual
// baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. Lives
// outside src/routes/ so the TanStack route generator does not pick it up.

test('home page renders the landing', async ({page}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', {level: 1, name: 'Version control, centered on review.'}),
  ).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Reviews'})).toBeVisible()
  await expect(page.getByRole('heading', {level: 2, name: 'Diffs'})).toBeVisible()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})

// The mark is declared once on the root route, and lives in public/ rather than
// the module graph -- so what is worth proving is that child routes inherit the
// link and that the build actually ships the file behind it.
for (const path of ['/', '/diffs']) {
  test(`${path} links the favicon`, async ({page}) => {
    await page.goto(path)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  })
}

// Measures the mark against the bare text node beside it, rather than against
// the element wrapping them both -- that wrapper starts where the mark starts,
// so comparing the two can never fail. A Range is the only way to get a box
// around a text node that has no element of its own.
async function measureMarkAgainstName(page: Page) {
  return page.evaluate(() => {
    const mark = document.querySelector('[data-slot="site-mark"]')
    if (mark === null) return null
    const row = mark.parentElement
    if (row === null) return null
    const name = [...row.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
    )
    if (name === undefined) return null
    const range = document.createRange()
    range.selectNodeContents(name)
    return {
      markRight: mark.getBoundingClientRect().right,
      nameLeft: range.getBoundingClientRect().left,
      nameText: (name.textContent ?? '').trim(),
    }
  })
}

// The same mark also renders in the page, leading the name at the top left of
// each surface. The third placement -- the diffs viewer header -- is not
// covered here because reaching it means fetching a real diff from GitHub,
// which this suite stays clear of; it shares the component these two prove.
for (const [path, name] of [
  ['/', 'revision.city'],
  ['/diffs', 'Diffs'],
] as const) {
  test(`${path} leads ${name} with the mark`, async ({page}) => {
    await page.goto(path)
    await expect(page.locator('[data-slot="site-mark"]').first()).toBeVisible()

    const measured = await measureMarkAgainstName(page)

    expect(measured?.nameText).toBe(name)
    // Ahead of the name rather than trailing it, which is the whole request.
    expect(measured?.markRight).toBeLessThanOrEqual(measured?.nameLeft ?? 0)
  })
}

test('favicon is served as an svg', async ({request}) => {
  const response = await request.get('/favicon.svg')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  // Really the SVG, rather than the SPA fallback document a build that dropped
  // public/ would answer an unknown path with.
  expect(await response.text()).toContain('<svg')
})
