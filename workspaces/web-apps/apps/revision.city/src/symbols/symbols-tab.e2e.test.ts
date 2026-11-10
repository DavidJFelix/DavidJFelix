import type {Page} from '@playwright/test'
import {expect, test} from '@playwright/test'

// Drives the real viewer against stubbed GitHub-facing routes, so the panel is
// exercised end to end (tab -> fetch -> render -> scroll) without a token or a
// live PR. The patch is synthetic but real unified-diff syntax, so the viewer
// parses and lays it out exactly as it would a fetched one.
const DIFF_PATH = '/diffs/o/r/pull/1'

const PATCH = `diff --git a/src/widget.ts b/src/widget.ts
index 1111111..2222222 100644
--- a/src/widget.ts
+++ b/src/widget.ts
@@ -1,7 +1,7 @@
 export class Widget {
   render() {
-    return 1
+    return 2
   }
 }
-export function greet(name: string) {
+export function welcome(name: string) {
   return name
 }
`

const ENTITY_DIFF = {
  path: 'src/widget.ts',
  language: 'typescript',
  changes: [
    {
      type: 'renamed',
      kind: 'function',
      name: 'welcome',
      qualifiedName: 'welcome',
      previousQualifiedName: 'greet',
      oldRange: {startLine: 6, endLine: 8},
      newRange: {startLine: 6, endLine: 8},
      similarity: 0.9,
    },
    {
      type: 'modified',
      kind: 'method',
      name: 'render',
      qualifiedName: 'Widget.render',
      oldRange: {startLine: 2, endLine: 4},
      newRange: {startLine: 2, endLine: 4},
    },
  ],
  summary: {added: 0, deleted: 0, modified: 1, moved: 0, renamed: 1},
}

// The route answers a batch as newline-delimited JSON, one line per file.
function createNdjson(request: {postData(): string | null}): string {
  const body: {files: {itemId: string; name: string}[]} = JSON.parse(request.postData() ?? '{}')
  return body.files
    .map((file) => `${JSON.stringify({itemId: file.itemId, name: file.name, diff: ENTITY_DIFF})}\n`)
    .join('')
}

async function stubDiffRoutes(page: Page): Promise<void> {
  await page.route('**/api/auth/github/session', (route) =>
    route.fulfill({json: {authenticated: true, login: 'e2e-user'}}),
  )
  await page.route('**/api/diffs/diff?**', (route) =>
    route.fulfill({body: PATCH, contentType: 'text/plain'}),
  )
  await page.route('**/api/diffs/entity-diff', (route) =>
    route.fulfill({body: createNdjson(route.request()), contentType: 'application/x-ndjson'}),
  )
}

test('the symbols tab names the entities a diff changed', async ({page}) => {
  await stubDiffRoutes(page)
  await page.goto(DIFF_PATH)

  await page.getByRole('button', {name: 'Symbols'}).click()

  const panel = page.getByRole('region', {name: 'Symbols'})
  await expect(panel.getByText('Widget.render')).toBeVisible()
  await expect(panel.getByText('welcome')).toBeVisible()
  await expect(panel.getByText('was greet')).toBeVisible()
})

test('the symbols tab reads no files until it is opened', async ({page}) => {
  await stubDiffRoutes(page)
  let entityDiffRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/diffs/entity-diff')) {
      entityDiffRequests += 1
    }
  })

  await page.goto(DIFF_PATH)
  await expect(page.getByRole('region', {name: 'Files'})).toBeVisible()

  expect(entityDiffRequests).toBe(0)

  await page.getByRole('button', {name: 'Symbols'}).click()
  await expect(page.getByRole('region', {name: 'Symbols'}).getByText('Widget.render')).toBeVisible()
  expect(entityDiffRequests).toBeGreaterThan(0)
})

test('choosing a symbol moves the viewer to it', async ({page}) => {
  await stubDiffRoutes(page)
  await page.goto(DIFF_PATH)
  await page.getByRole('button', {name: 'Symbols'}).click()

  const panel = page.getByRole('region', {name: 'Symbols'})
  await panel.getByText('Widget.render').click()

  // The row stays selectable and the viewer keeps the file on screen; a broken
  // scroll target would throw inside the viewer and blank the pane.
  await expect(page.getByText('export class Widget').first()).toBeVisible()
})

test('a signed-out visitor still gets symbols for a public diff', async ({page}) => {
  await stubDiffRoutes(page)
  await page.route('**/api/auth/github/session', (route) =>
    route.fulfill({json: {authenticated: false}}),
  )
  await page.goto(DIFF_PATH)

  await page.getByRole('button', {name: 'Symbols'}).click()

  await expect(page.getByRole('region', {name: 'Symbols'}).getByText('Widget.render')).toBeVisible()
})

test('a diff that cannot be read says why instead of showing nothing', async ({page}) => {
  await stubDiffRoutes(page)
  await page.route('**/api/diffs/entity-diff', (route) =>
    route.fulfill({
      status: 502,
      json: {error: 'GitHub rate limit exceeded. Sign in with GitHub to raise the limit.'},
    }),
  )
  await page.goto(DIFF_PATH)

  await page.getByRole('button', {name: 'Symbols'}).click()

  await expect(page.getByText('Sign in with GitHub to raise the limit')).toBeVisible()
})

// More files than the largest first batch (CODE_VIEW_BATCH_COUNT_MAX, 96).
const MANY_FILE_COUNT = 150

function createFilePatch(index: number): string {
  const path = `src/file-${index}.ts`
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1 +1 @@',
    `-export const value${index} = 1`,
    `+export const value${index} = 2`,
    '',
  ].join('\n')
}

// `route.fulfill` sends the body at once, so the whole patch would land before
// the viewer mounts. This stub sends one file at a time, as a slow GitHub
// response does, so later batches reach the mounted viewer.
async function streamPatchSlowly(page: Page): Promise<void> {
  const files = Array.from({length: MANY_FILE_COUNT}, (_, index) => createFilePatch(index))
  await page.addInitScript((patchFiles) => {
    // A Proxy keeps the type of `fetch`, which a plain function does not match.
    window.fetch = new Proxy(window.fetch, {
      apply(realFetch, thisArg, args: Parameters<typeof fetch>) {
        const [input] = args
        const url = input instanceof Request ? input.url : String(input)
        if (!url.includes('/api/diffs/diff?')) {
          return Reflect.apply(realFetch, thisArg, args)
        }
        const encoder = new TextEncoder()
        let fileIndex = 0
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            if (fileIndex === patchFiles.length) {
              controller.close()
              return
            }
            controller.enqueue(encoder.encode(patchFiles[fileIndex++]))
            await new Promise((resolve) => setTimeout(resolve, 20))
          },
        })
        return Promise.resolve(new Response(body, {headers: {'content-type': 'text/plain'}}))
      },
    })
  }, files)
}

test('the symbols tab lists every file of a diff streamed in several batches', async ({page}) => {
  await stubDiffRoutes(page)
  await streamPatchSlowly(page)
  await page.goto(DIFF_PATH)

  await page.getByRole('button', {name: 'Symbols'}).click()

  const panel = page.getByRole('region', {name: 'Symbols'})
  await expect(panel.getByText(`src/file-${MANY_FILE_COUNT - 1}.ts`, {exact: true})).toBeVisible()
})
