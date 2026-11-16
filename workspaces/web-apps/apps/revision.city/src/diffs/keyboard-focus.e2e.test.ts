import type {Locator, Page} from '@playwright/test'
import {expect, test} from '@playwright/test'

// Proves that keyboard focus on the viewer chrome shows a solid outline in the
// chrome text color. jsdom computes no focus styles, so this runs in a real
// browser against a stubbed diff.
const DIFF_PATH = '/diffs/o/r/pull/1'

const PATCH = `diff --git a/src/widget.ts b/src/widget.ts
index 1111111..2222222 100644
--- a/src/widget.ts
+++ b/src/widget.ts
@@ -1,3 +1,3 @@
 export class Widget {
-  size = 1
+  size = 2
 }
`

const MAX_TAB_PRESSES = 60

async function openDiff(page: Page): Promise<void> {
  await page.route('**/api/auth/github/session', (route) =>
    route.fulfill({json: {authenticated: false}}),
  )
  await page.route('**/api/diffs/diff?**', (route) =>
    route.fulfill({body: PATCH, contentType: 'text/plain'}),
  )
  await page.goto(DIFF_PATH)
  await expect(page.getByText('export class Widget').first()).toBeVisible()
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab did not reach the target in ${MAX_TAB_PRESSES} presses`)
}

async function readOutline(target: Locator): Promise<{style: string; color: string; text: string}> {
  return target.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {style: computed.outlineStyle, color: computed.outlineColor, text: computed.color}
  })
}

test('keyboard focus shows a text color outline on a chrome button and a sidebar toggle', async ({
  page,
}) => {
  await openDiff(page)

  for (const name of ['Display settings', 'Diff Stats']) {
    const target = page.getByRole('button', {name})
    await tabTo(page, target)
    // The Button recipe transitions colors, so wait for the outline color to settle.
    await expect
      .poll(async () => {
        const outline = await readOutline(target)
        return outline.style === 'solid' && outline.color === outline.text
      })
      .toBe(true)
  }
})
