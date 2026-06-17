/// <reference types="bun" />
// Pre-merge smoke gate: boots the *built* worker locally under workerd (via
// `wrangler dev`) and checks the critical path serves a working bundle -- the
// route returns 200, the response is a complete HTML document, and any hashed
// client asset it references itself serves. Catches the "deployed but broken"
// class before merge, not after.
//
// Why wrangler dev and not `vite preview`: monicandavid.com is SvelteKit on
// Cloudflare (adapter-cloudflare). SvelteKit's `vite preview` runs the SSR app
// under *Node*, not workerd -- it would pass while smoking the wrong runtime.
// Booting the adapter's _worker.js under wrangler exercises the artifact that
// actually ships. The worker entry, assets dir, and compatibility settings are
// all read from wrangler.toml (config-driven dev), so the local runtime matches
// the deployed one. Assumes `vite build` has run (the `smoke` task depends on
// `build`); parameterized via SMOKE_ROUTES / SMOKE_PORT.

import {existsSync} from 'node:fs'

const PORT = Number(process.env.SMOKE_PORT ?? 4317)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROUTES = (process.env.SMOKE_ROUTES ?? '/').split(',')
const WORKER = '.svelte-kit/cloudflare/_worker.js'
const READY_TIMEOUT_MS = 60_000

if (!existsSync(WORKER)) {
  console.error(`::error::${WORKER} is missing -- run \`mise run build\` first`)
  process.exit(1)
}

// Spawn the wrangler binary directly (not via `pnpm exec`): killing the pnpm
// wrapper does not cascade to wrangler/workerd, which would then outlive
// teardown and keep holding the port. Worker entry, --assets, and compatibility
// settings come from wrangler.toml, so this matches the deploy exactly.
const worker = Bun.spawn(
  ['node_modules/.bin/wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'],
  {
    env: {...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false'},
    stdout: 'ignore',
    stderr: 'inherit',
  },
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
      `::error::worker did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
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
  worker.kill()
  await Promise.race([worker.exited, Bun.sleep(3_000)])
  worker.kill('SIGKILL')
}

process.exit(exitCode)
