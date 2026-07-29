import type {Page} from '@playwright/test'
import {expect, test} from '@playwright/test'

// The plan config lives in URL search params, so the baseline pins every
// input (including `today`, which feasibility uses) — the render has no
// current-date dependency. These run against a local production boot
// (baseline authoring) or a deployed preview URL (CI) -- see
// playwright.config.ts. Lives outside src/routes/ so the TanStack route
// generator does not pick it up.

const PLAN_URL =
  '/?dist=marathon&race=2026-10-18&goal=4:30:00&wm=24&weeks=20&rd=fiveK&rt=25:00&today=2026-07-01'

// The grid (desktop) and agenda (phones) both render race day; filter to
// whichever the current viewport shows.
const raceDay = (page: Page) => page.getByText('RACE! - 26.2').filter({visible: true})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto(PLAN_URL)
  // Wait for the SPA to hydrate (the race-week row renders) before snapshotting.
  await expect(raceDay(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {fullPage: true, maxDiffPixelRatio: 0.01})
})

// Phones swap the 7-column grid for the stacked agenda: the whole plan is
// readable with zero horizontal page overflow.
test('shows the agenda on a phone viewport without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto(PLAN_URL)
  await expect(raceDay(page)).toBeVisible()
  // Agenda day rows (with weekday + date labels) replace the grid.
  await expect(page.getByText('Sun 10/18').filter({visible: true})).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

test('system dark is applied before first paint', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

test('a persisted override beats the OS preference', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light')
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('the theme toggle cycles modes and persists the choice', async ({page}) => {
  await page.goto('/')
  // Fresh visit starts in system mode; the first press switches to light.
  await page.getByRole('button', {name: 'Switch to light theme'}).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.getByRole('button', {name: 'Switch to dark theme'}).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark')
  // The choice survives a reload via the pre-paint bootstrap.
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})
