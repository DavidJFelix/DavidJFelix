/// <reference types="bun" />
// Pre-merge smoke gate: boots the production build and checks the critical path
// serves a working bundle -- the route returns 200, the response is a complete
// HTML document, and any hashed client asset it references itself serves.
//
// revision.city is a TanStack Start app on Cloudflare Workers; its
// @cloudflare/vite-plugin makes `vite preview` serve the built worker (SSR) in
// workerd, so `/` exercises the real render path. A dev-mode bundle would
// reference a virtual dev entry that 404s here -- exactly the "deployed but
// broken" class this catches before merge. Assumes `vite build` has run (the
// `smoke` task depends on `build`); parameterized via SMOKE_ROUTES / SMOKE_PORT.

import {existsSync} from 'node:fs'

const PORT = Number(process.env.SMOKE_PORT ?? 4173)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROUTES = (process.env.SMOKE_ROUTES ?? '/').split(',')
const READY_TIMEOUT_MS = 60_000

if (!existsSync('dist')) {
  console.error('::error::dist is missing -- run `mise run build` first')
  process.exit(1)
}

// Spawn the preview binary directly (not through `pnpm run`): killing the pnpm
// wrapper does not cascade to the server, so it would outlive teardown and hold
// the port. Detached stdio keeps the server from holding this process's pipes
// open, which would otherwise stall a `... | tail` pipeline after we exit.
const server = Bun.spawn(
  ['node_modules/.bin/vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
  {env: {...process.env, CI: 'true'}, stdout: 'ignore', stderr: 'ignore'},
)

// A dev-mode bundle references this Vite/TanStack dev virtual entry (the 2026-06-11 f311x
// incident); reject it, and require a real hashed asset -- a dev bundle references no hashed
// `.js`/`.css`, so without this the check would pass vacuously.
const DEV_ENTRY = 'virtual:tanstack-start-dev-client-entry'

async function check(route: string): Promise<string | null> {
  const page = await fetch(new URL(route, BASE_URL), {signal: AbortSignal.timeout(15_000)})
  if (!page.ok) return `${route} -> HTTP ${page.status}`
  const html = await page.text()
  if (!/<\/html>/i.test(html)) return `${route} -> response is not a complete HTML document`
  if (html.includes(DEV_ENTRY))
    return `${route} -> serves a dev-mode bundle (dev virtual entry present)`
  const asset = html.match(/(?:src|href)="(\/[^"]+\.(?:js|css))"/)?.[1]
  if (!asset) return `${route} -> no hashed client asset referenced in HTML`
  const res = await fetch(new URL(asset, BASE_URL), {signal: AbortSignal.timeout(15_000)})
  if (!res.ok) return `${route} asset ${asset} -> HTTP ${res.status}`
  return null
}

async function waitForReady(): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, {signal: AbortSignal.timeout(2_000)})
      if (res.ok) return true
    } catch {
      // not up yet -- keep polling
    }
    await Bun.sleep(500)
  }
  return false
}

let exitCode = 0
try {
  if (!(await waitForReady())) {
    console.error(
      `::error::preview did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
    )
    exitCode = 1
  } else {
    for (const route of ROUTES) {
      const problem = await check(route)
      if (problem === null) {
        console.log(`OK: ${route} serves a working bundle`)
      } else {
        console.error(`::error::smoke test failed — ${problem}`)
        exitCode = 1
      }
    }
  }
} finally {
  server.kill()
  await Promise.race([server.exited, Bun.sleep(3_000)])
  server.kill('SIGKILL')
}

process.exit(exitCode)
