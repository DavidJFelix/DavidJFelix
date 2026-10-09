import {expect, test} from '@playwright/test'

// The test answers the diff request with this patch, so the page needs no
// GitHub access. The repository cannot exist (GitHub allows no consecutive
// hyphens in a name).
const PULL_PATH = '/diffs/no--such--org/no--such--repo/pull/1'
const PATCH = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,3 +1,3 @@',
  ' export const a = 1',
  '-export const b = 2',
  '+export const b = 3',
  ' export const c = 4',
  '',
].join('\n')

// worker-pool-context.tsx starts one worker less than the core count, and at
// most three on a desktop browser. With this core count, the pool always starts
// three workers, and each worker loads the script once.
const CORE_COUNT = 8
const POOL_SIZE = 3

test('a diff renders highlighted on the main thread when the worker script fails to load', async ({
  page,
}) => {
  await page.addInitScript((coreCount) => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {get: () => coreCount})
  }, CORE_COUNT)
  let workerScriptLoads = 0
  await page.route(/\/assets\/worker-[^/]+\.js$/, (route) => {
    // The worker failure report fetches the script again to read its status.
    // That request is a `fetch`, and a worker load is a `script`.
    if (route.request().resourceType() === 'script') workerScriptLoads += 1
    return route.fulfill({status: 404, contentType: 'text/plain', body: 'Not Found'})
  })
  await page.route(/\/api\/diffs\/diff\?/, (route) =>
    route.fulfill({contentType: 'text/plain', body: PATCH}),
  )

  await page.goto(PULL_PATH)

  const addedLine = page.locator('diffs-container [data-line][data-line-type="change-addition"]')
  await expect(addedLine).toHaveText('export const b = 3')
  // A highlighted token carries its color; a plain-text line has none.
  await expect(addedLine.locator('span[style*="--diffs-token-"]').first()).toBeVisible()
  // Fewer loads means the route did not fail the pool. More loads means the
  // viewer started the failed pool again, which hides the diff while the new
  // workers initialize.
  expect(workerScriptLoads).toBe(POOL_SIZE)
})
