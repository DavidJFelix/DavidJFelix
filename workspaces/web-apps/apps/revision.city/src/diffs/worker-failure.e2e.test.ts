import {expect, test} from '@playwright/test'

test('a diffs worker script that fails to load is reported once with its refetch status', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(/\/assets\/worker-[^/]+\.js$/, (route) =>
    route.fulfill({status: 404, contentType: 'text/plain', body: 'Not Found'}),
  )

  await page.goto('/diffs')

  await expect
    .poll(() => pageErrors)
    .toEqual([
      expect.stringMatching(
        /^The diffs worker script failed to load, and a refetch of \/assets\/worker-[^/]+\.js returned 404 \(text\/plain, 9 bytes\)\./,
      ),
    ])
})
