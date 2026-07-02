import {expect, test} from '@playwright/test'

// The plan config lives in URL search params, so the baseline pins every
// input (including `today`, which feasibility uses) — the render has no
// current-date dependency. These run against a local production boot
// (baseline authoring) or a deployed preview URL (CI) -- see
// playwright.config.ts. Lives outside src/routes/ so the TanStack route
// generator does not pick it up.

const PLAN_URL =
  '/?dist=marathon&race=2026-10-18&goal=4:30:00&wm=24&weeks=20&rd=fiveK&rt=25:00&today=2026-07-01'

test('home page matches the visual baseline', async ({page}) => {
  await page.goto(PLAN_URL)
  // Wait for the SPA to hydrate (the race-week row renders) before snapshotting.
  await expect(page.getByText('RACE! - 26.2')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {fullPage: true, maxDiffPixelRatio: 0.01})
})
