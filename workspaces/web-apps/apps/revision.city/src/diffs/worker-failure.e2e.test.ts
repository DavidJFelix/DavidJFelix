import {expect, test} from '@playwright/test'

// The worker script's name is `worker-` and an eight-character hash. Other chunks also start with
// `worker-`, for example `worker-pool-context-<hash>.js`.
const WORKER_SCRIPT = /\/assets\/worker-[\w-]{8}\.js$/

test('a diffs worker script that fails to load with a server error is reported once with its refetch status', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(WORKER_SCRIPT, (route) =>
    route.fulfill({status: 503, contentType: 'text/plain', body: 'Unavailable'}),
  )

  await page.goto('/diffs')

  await expect
    .poll(() => pageErrors)
    .toEqual([
      expect.stringMatching(
        /^The diffs worker script failed to load, and a refetch of \/assets\/worker-[^/]+\.js returned 503 \(text\/plain, 11 bytes\)\. The page was open for \d+ s, and navigator\.onLine is true\.$/,
      ),
    ])
})
