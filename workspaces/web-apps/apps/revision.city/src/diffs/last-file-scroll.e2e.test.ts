import {expect, test} from '@playwright/test'

// The repository cannot exist (GitHub allows no consecutive hyphens in a
// name), and the test answers the diff request itself.
const PULL_PATH = '/diffs/no--such--org/no--such--repo/pull/1'

// Each file changes one line in the middle of a longer file, so the patch does
// not hold the end of the file. A signed-in viewer then shows a "more unchanged
// context" row below each file.
const FILE_COUNT = 30
const PATCH = Array.from({length: FILE_COUNT}, (_, index) =>
  [
    `diff --git a/src/file-${index}.ts b/src/file-${index}.ts`,
    'index 1111111..2222222 100644',
    `--- a/src/file-${index}.ts`,
    `+++ b/src/file-${index}.ts`,
    '@@ -10,3 +10,3 @@',
    ` export const before${index} = 1`,
    `-export const changed${index} = 2`,
    `+export const changed${index} = 3`,
    ` export const after${index} = 4`,
  ].join('\n'),
).join('\n')

// Long enough for the diff to render before the session answers when the
// viewer does not wait for it.
const SESSION_DELAY_MS = 1500

test('the last file scrolls fully into view when the session answers after the diff', async ({
  page,
}) => {
  await page.route(/\/api\/diffs\/diff\?/, (route) =>
    route.fulfill({contentType: 'text/plain', body: PATCH}),
  )
  await page.route('**/api/auth/github/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SESSION_DELAY_MS))
    await route.fulfill({json: {authenticated: true, login: 'reviewer'}})
  })

  await page.goto(PULL_PATH)
  const files = page.locator('diffs-container')
  await expect(files.first()).toBeVisible()

  const scroller = page.locator('.cv-scrollbar')
  const lastFile = page.locator('diffs-container', {hasText: `changed${FILE_COUNT - 1}`})
  // The viewer renders the files near the bottom only after the scroll. Each
  // render can change the scroll height, so scroll again until it stops changing.
  await expect(async () => {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(lastFile).toBeVisible()
    const scrollerBox = await scroller.boundingBox()
    const lastFileBox = await lastFile.boundingBox()
    expect(scrollerBox).not.toBeNull()
    expect(lastFileBox).not.toBeNull()
    if (scrollerBox === null || lastFileBox === null) return
    expect(lastFileBox.y + lastFileBox.height).toBeLessThanOrEqual(
      scrollerBox.y + scrollerBox.height + 1,
    )
  }).toPass()
  // Without this row the file heights never change, and the test proves nothing.
  await expect(lastFile.getByText('More unchanged context may be available').first()).toBeVisible()
})
