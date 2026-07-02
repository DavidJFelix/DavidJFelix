/// <reference types="bun" />
// Pre-merge smoke gate: boots the production build and checks the critical path
// serves a working bundle -- each route returns 200, the response is a complete
// HTML document, and any hashed client asset it references itself serves. The
// app has a backend (the Flue agent API under /api), so the gate also POSTs the
// chat endpoint and requires the echo, catching a broken agent runtime (bad DO
// migration, dropped assets binding, dead /api mount) before merge.
// Deterministic and secret-free.
//
// Assumes `pnpm run build` has run (the `smoke` mise task depends on `build`).
// Boots the FLUE worker config -- the artifact CD deploys -- not the Astro
// adapter's dist/server config, which is only Astro's build-validation shape
// and contains neither /api nor the Durable Objects.

import {existsSync} from 'node:fs'

const PORT = Number(process.env.SMOKE_PORT ?? 4321)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROUTES = (process.env.SMOKE_ROUTES ?? '/,/chat').split(',')
const WORKER_CONFIG = 'dist-flue/onvibes_org/wrangler.json'
const READY_TIMEOUT_MS = 60_000

if (!existsSync(WORKER_CONFIG)) {
  console.error(`::error::${WORKER_CONFIG} is missing -- run \`mise run build\` first`)
  process.exit(1)
}

// Boot the built Flue worker (which hosts the Astro worker inside it) in
// workerd via `wrangler dev`. Spawn the wrangler binary directly (not through
// `pnpm run`): killing the pnpm wrapper does not cascade to the server, so it
// would outlive teardown and hold the port.
const server = Bun.spawn(
  [
    'node_modules/.bin/wrangler',
    'dev',
    '-c',
    WORKER_CONFIG,
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

// Exercise the backend end to end: send one message through the Flue agent API
// (the same call the /chat island makes) and require the faux echo in the
// synchronous result. `?wait=result` makes the POST block until the agent turn
// settles instead of returning a 202 admission.
async function checkAgent(): Promise<string | null> {
  const message = 'smoke ping'
  const res = await fetch(new URL('/api/agents/assistant/smoke-test?wait=result', BASE_URL), {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({message}),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return `agent POST -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
  const body = await res.text()
  if (!body.includes(`You said: ${message}`)) {
    return `agent result does not contain the echo -- got: ${body.slice(0, 200)}`
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
    const agentProblem = await checkAgent()
    if (agentProblem === null) {
      console.log('OK: agent API echoes through /api/agents/assistant')
    } else {
      console.error(`::error::smoke test failed — ${agentProblem}`)
      exitCode = 1
    }
  }
} finally {
  server.kill()
  await Promise.race([server.exited, Bun.sleep(3_000)])
  server.kill('SIGKILL')
}

process.exit(exitCode)
