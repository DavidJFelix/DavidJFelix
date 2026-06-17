import {expect, test} from '@playwright/test'

// ravrun renders a fixed demo training schedule (start date 2024-12-23, no
// current-date dependency; the random UUIDs are React keys, not visible), so the
// visual baseline is stable. These run against a local production boot (baseline
// authoring) or a deployed preview URL (CI) -- see playwright.config.ts. Lives
// outside src/routes/ so the TanStack route generator does not pick it up.

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  // Wait for the SPA to hydrate (the root nav renders) before snapshotting.
  await expect(page.getByRole('link', {name: 'Home'})).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
