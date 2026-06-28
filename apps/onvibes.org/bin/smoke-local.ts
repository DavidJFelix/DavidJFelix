/// <reference types="bun" />
// Pre-merge smoke gate: boots the production preview server and checks the
// critical path serves a working bundle -- each route returns 200, the response
// is a complete HTML document, and any hashed client asset it references itself
// serves. Catches the "deployed but broken" class (route 404/500, missing
// assets) before merge. Deterministic and secret-free.
//
// Assumes `astro build` has run (the `smoke` mise task depends on `build`). The
// gate is parameterized (SMOKE_ROUTES / SMOKE_PORT) so the same checks can later
// target a per-PR preview deploy.

import {existsSync} from 'node:fs'

const PORT = Number(process.env.SMOKE_PORT ?? 4321)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROUTES = (process.env.SMOKE_ROUTES ?? '/').split(',')
const READY_TIMEOUT_MS = 60_000

if (!existsSync('dist/server/wrangler.json')) {
  console.error('::error::dist/server/wrangler.json is missing -- run `mise run build` first')
  process.exit(1)
}

// Boot the built worker + static assets in workerd via `wrangler dev`, not
// `astro preview` (which the Cloudflare adapter does not support and which would
// 404 the on-demand /diag and /bugs routes). Point at the @astrojs/cloudflare
// adapter's generated config (built into dist/server). Spawn the wrangler binary
// directly (not through `pnpm run`): killing the pnpm wrapper does not cascade to
// the server, so it would outlive teardown and hold the port.
const server = Bun.spawn(
  [
    'node_modules/.bin/wrangler',
    'dev',
    '-c',
    'dist/server/wrangler.json',
    '--ip',
    '127.0.0.1',
    '--port',
    String(PORT),
  ],
  {env: {...process.env, CI: 'true'}, stdout: 'ignore', stderr: 'ignore'},
)

async function check(route: string): Promise<string | null> {
  const page = await fetch(new URL(route, BASE_URL), {signal: AbortSignal.timeout(15_000)})
  if (!page.ok) return `${route} -> HTTP ${page.status}`
  const html = await page.text()
  if (!/<\/html>/i.test(html)) return `${route} -> response is not a complete HTML document`
  const asset = html.match(/(?:src|href)="(\/[^"]+\.(?:js|css))"/)?.[1]
  if (asset) {
    const res = await fetch(new URL(asset, BASE_URL), {signal: AbortSignal.timeout(15_000)})
    if (!res.ok) return `${route} asset ${asset} -> HTTP ${res.status}`
  }
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
