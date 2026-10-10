import {expect, type Page, type Route, test} from '@playwright/test'

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

// The worker script's name is `worker-` and an eight-character hash. Other chunks also start with
// `worker-`, for example `worker-pool-context-<hash>.js`.
const WORKER_SCRIPT = /\/assets\/worker-[\w-]{8}\.js$/

// The worker failure report fetches the script again to read its status. That
// request is a `fetch`, and a worker load is a `script`.
const isWorkerLoad = (route: Route): boolean => route.request().resourceType() === 'script'

const NOT_FOUND = {status: 404, contentType: 'text/plain', body: 'Not Found'}
const UNAVAILABLE = {status: 503, contentType: 'text/plain', body: 'Unavailable'}

async function openPullWithPatch(page: Page): Promise<void> {
  await page.addInitScript((coreCount) => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {get: () => coreCount})
  }, CORE_COUNT)
  await page.route(/\/api\/diffs\/diff\?/, (route) =>
    route.fulfill({contentType: 'text/plain', body: PATCH}),
  )
}

async function expectHighlightedDiff(page: Page): Promise<void> {
  const addedLine = page.locator('diffs-container [data-line][data-line-type="change-addition"]')
  await expect(addedLine).toHaveText('export const b = 3')
  // A highlighted token carries its color; a plain-text line has none.
  await expect(addedLine.locator('span[style*="--diffs-token-"]').first()).toBeVisible()
}

test('a diff renders highlighted on the main thread when the worker script fails to load', async ({
  page,
}) => {
  await openPullWithPatch(page)
  let workerScriptLoads = 0
  await page.route(WORKER_SCRIPT, (route) => {
    if (isWorkerLoad(route)) workerScriptLoads += 1
    return route.fulfill(UNAVAILABLE)
  })

  await page.goto(PULL_PATH)

  await expectHighlightedDiff(page)
  // Fewer loads means the route did not fail the pool. More loads means the
  // viewer started the failed pool again, which hides the diff while the new
  // workers initialize.
  expect(workerScriptLoads).toBe(POOL_SIZE)
})

test('the pool starts again when the worker script fails to load but its refetch succeeds', async ({
  page,
}) => {
  await openPullWithPatch(page)
  let workerScriptLoads = 0
  await page.route(WORKER_SCRIPT, (route) => {
    if (!isWorkerLoad(route)) return route.continue()
    workerScriptLoads += 1
    return workerScriptLoads <= POOL_SIZE ? route.fulfill(NOT_FOUND) : route.continue()
  })
  let pageLoads = 0
  page.on('load', () => {
    pageLoads += 1
  })

  await page.goto(PULL_PATH)

  await expectHighlightedDiff(page)
  // The first pool fails, the second pool starts, and the page does not reload.
  expect(workerScriptLoads).toBe(2 * POOL_SIZE)
  expect(pageLoads).toBe(1)
})

test('the page reloads once when a deploy removed the worker script, then renders on the main thread', async ({
  page,
}) => {
  await openPullWithPatch(page)
  let workerScriptLoads = 0
  await page.route(WORKER_SCRIPT, (route) => {
    if (isWorkerLoad(route)) workerScriptLoads += 1
    return route.fulfill(NOT_FOUND)
  })
  let pageLoads = 0
  page.on('load', () => {
    pageLoads += 1
  })

  await page.goto(PULL_PATH)

  await expect.poll(() => pageLoads).toBe(2)
  await expectHighlightedDiff(page)
  // Each page load starts the pool once. The reload mark stops a second reload.
  expect(workerScriptLoads).toBe(2 * POOL_SIZE)
  expect(pageLoads).toBe(2)
})
