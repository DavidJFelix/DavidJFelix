/// <reference types="bun" />
// Pre-merge smoke gate: boots the production build and checks the critical path
// serves a working bundle -- the route returns 200, the response is a complete
// HTML document, and any hashed client asset it references itself serves.
//
// alchemy-state-viewer is a SvelteKit SSR app on Cloudflare Workers; the
// cloudflare adapter emits `.svelte-kit/cloudflare/_worker.js`, so the boot is
// `wrangler dev` on the built worker (workerd) -- `vite preview` cannot serve
// it. With no ALCHEMY_STATE_* secrets configured the app renders its setup
// page, so the gate stays deterministic and secret-free. Assumes `vite build`
// has run (the `smoke` task depends on `build`); parameterized via
// SMOKE_ROUTES / SMOKE_PORT.

import {existsSync} from 'node:fs'

const PORT = Number(process.env.SMOKE_PORT ?? 4174)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROUTES = (process.env.SMOKE_ROUTES ?? '/').split(',')
const READY_TIMEOUT_MS = 60_000

if (!existsSync('.svelte-kit/cloudflare/_worker.js')) {
  console.error(
    '::error::.svelte-kit/cloudflare/_worker.js is missing -- run `mise run build` first',
  )
  process.exit(1)
}

// Spawn the wrangler binary directly (not through `pnpm run`): killing the pnpm
// wrapper does not cascade to the server, so it would outlive teardown and hold
// the port. `--inspector-port 0` avoids clashing with anything else on 9229.
// Blank the committed ALCHEMY_STATE_URL var so the gate exercises the
// deterministic unconfigured boot instead of reaching for the real store.
const server = Bun.spawn(
  [
    'node_modules/.bin/wrangler',
    'dev',
    '--ip',
    '127.0.0.1',
    '--port',
    String(PORT),
    '--inspector-port',
    '0',
    '--var',
    'ALCHEMY_STATE_URL:',
  ],
  {
    env: {...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false'},
    stdout: 'ignore',
    stderr: 'ignore',
  },
)

async function check(route: string): Promise<string | null> {
  const page = await fetch(new URL(route, BASE_URL), {signal: AbortSignal.timeout(15_000)})
  if (!page.ok) return `${route} -> HTTP ${page.status}`
  const html = await page.text()
  if (!/<\/html>/iu.test(html)) return `${route} -> response is not a complete HTML document`
  // SvelteKit always references hashed immutable assets from a server-rendered
  // page; a missing reference means the build is broken, not minimal.
  const asset = html.match(/(?:src|href)="([^"]*\/_app\/immutable\/[^"]+\.(?:js|css))"/u)?.[1]
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
  const ready = await waitForReady()
  if (ready) {
    const problems = await Promise.all(ROUTES.map((route) => check(route)))
    for (const [index, problem] of problems.entries()) {
      if (problem === null) {
        console.log(`OK: ${ROUTES[index]} serves a working bundle`)
      } else {
        console.error(`::error::smoke test failed — ${problem}`)
        exitCode = 1
      }
    }
  } else {
    console.error(
      `::error::wrangler dev did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
    )
    exitCode = 1
  }
} finally {
  server.kill()
  await Promise.race([server.exited, Bun.sleep(3_000)])
  server.kill('SIGKILL')
}

process.exit(exitCode)
