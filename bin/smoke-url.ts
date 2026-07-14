#!/usr/bin/env bun
// Generic URL-based smoke gate for the wrangler apps' per-PR previews. The
// static/SSR sibling of each app's bin/smoke-local.ts: instead of booting a
// local production server, it points the SAME checks at a deployed preview URL.
// A route passes when it returns 200, the body is a complete HTML document, and
// the first hashed JS/CSS asset it references itself serves. Each route gets a
// few attempts to cover transient blips; edge propagation after a fresh deploy
// is bin/await-url-ready.ts's job, gated before this runs. Parameterized by
// SMOKE_URL (base) + SMOKE_ROUTES so one implementation covers every app and
// can target a local boot or a remote preview.
//
// Usage: SMOKE_URL=https://pr-1-app.acct.workers.dev SMOKE_ROUTES=/,/about bun bin/smoke-url.ts

const base = process.env.SMOKE_URL
if (!base) {
  console.error('::error::SMOKE_URL must be set to the base URL to smoke')
  process.exit(1)
}
const routes = (process.env.SMOKE_ROUTES ?? '/').split(',')
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 5)
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 5_000)

// One route passes when it serves a complete HTML document whose first hashed
// client asset also serves -- the same contract every bin/smoke-local.ts uses,
// pointed at a remote URL.
async function check(route: string): Promise<string | null> {
  const page = await fetch(new URL(route, base), {signal: AbortSignal.timeout(15_000)})
  if (!page.ok) return `${route} -> HTTP ${page.status}`
  const html = await page.text()
  if (!/<\/html>/i.test(html)) return `${route} -> response is not a complete HTML document`
  const asset = html.match(/(?:src|href)="(\/[^"]+\.(?:js|css))"/)?.[1]
  if (asset) {
    const res = await fetch(new URL(asset, base), {signal: AbortSignal.timeout(15_000)})
    if (!res.ok) return `${route} asset ${asset} -> HTTP ${res.status}`
  }
  return null
}

const failures: Array<string> = []
for (const route of routes) {
  let lastProblem = 'unreachable'
  let passed = false
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const problem = await check(route)
      if (problem === null) {
        console.log(`OK: ${new URL(route, base)} serves a working bundle`)
        passed = true
        break
      }
      lastProblem = problem
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err)
    }
    if (attempt < attempts) await Bun.sleep(retryDelayMs)
  }
  if (!passed) failures.push(lastProblem)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::smoke test failed — ${failure}`)
  process.exit(1)
}
console.log(`all ${routes.length} route(s) serve a working bundle`)
