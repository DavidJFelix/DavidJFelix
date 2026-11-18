import type {Page} from '@playwright/test'
import {expect, test} from '@playwright/test'

// Drives the viewer's menus against a stubbed diff, so the settings, theme
// and status filter menus are exercised in a real browser. The patch changes
// one file and adds one, because the status filter shows only when a diff has
// more than one status.
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
diff --git a/src/gadget.ts b/src/gadget.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/gadget.ts
@@ -0,0 +1 @@
+export const gadget = 1
`

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

test('a settings switch toggles and leaves the settings menu open', async ({page}) => {
  await openDiff(page)

  await page.getByRole('button', {name: 'Display settings'}).click()
  const wordWrap = page.getByRole('checkbox', {name: 'Word wrap'})
  const wasChecked = await wordWrap.isChecked()
  await page.getByText('Word wrap').click()

  await expect(wordWrap).toBeChecked({checked: !wasChecked})
  await expect(page.getByRole('menu')).toBeVisible()
})

test('the theme menu opens a theme list and comes back to the main view', async ({page}) => {
  await openDiff(page)

  await page.getByRole('button', {name: 'Theme settings'}).click()
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem').nth(1).click()
  await expect(menu.getByRole('menuitem', {name: 'Light theme'})).toBeVisible()

  await menu.getByRole('menuitem', {name: 'Light theme'}).click()
  await expect(menu.getByRole('menuitem', {name: 'Light theme'})).toBeHidden()
  await expect(menu).toBeVisible()
})

test('the theme menu closes on Escape', async ({page}) => {
  await openDiff(page)

  await page.getByRole('button', {name: 'Theme settings'}).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('menu')).toBeHidden()
})

test('the status filter checks a status and keeps the menu open', async ({page}) => {
  await openDiff(page)

  await page.getByRole('button', {name: 'Filter by Git status'}).click()
  const status = page.getByRole('menuitemcheckbox').first()
  const wasChecked = (await status.getAttribute('aria-checked')) === 'true'
  await status.click()

  await expect(status).toHaveAttribute('aria-checked', String(!wasChecked))
  await expect(page.getByRole('menu')).toBeVisible()
})
