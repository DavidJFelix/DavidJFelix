// Post-deploy gate: proves prod is serving a working production bundle
// instead of trusting deploy exit codes (which the alchemy CLI's
// hang-after-success makes unreliable — see bin/deploy-prod.ts).
//
// A page passes when its HTML references hashed client assets, does NOT
// reference the Vite dev virtual entry (the 2026-06-11 incident: dev-mode
// SSR bundles shipped `/@id/virtual:tanstack-start-dev-client-entry`, which
// 404s in production so the page never hydrates), and its client JS entry
// actually serves. Each URL gets a few attempts to ride out propagation.

const DEV_ENTRY = 'virtual:tanstack-start-dev-client-entry'
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS ?? 6)
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 10_000)
const urls = (
  process.env.SMOKE_URLS ??
  'https://f311x-website-prod-ddptpca6nyzpodvc.nullserve.workers.dev/,https://f311x.com/'
).split(',')

const failures: string[] = []

async function check(url: string): Promise<string | null> {
  const page = await fetch(url, {signal: AbortSignal.timeout(15_000)})
  if (!page.ok) return `HTTP ${page.status}`
  const html = await page.text()
  if (html.includes(DEV_ENTRY)) return 'serves a dev-mode bundle (dev virtual entry present)'
  const entry = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
  if (!entry) return 'no hashed client JS entry in HTML'
  const asset = await fetch(new URL(entry, url), {signal: AbortSignal.timeout(15_000)})
  if (!asset.ok) return `client entry ${entry} -> HTTP ${asset.status}`
  return null
}

for (const url of urls) {
  let lastProblem = 'unreachable'
  let passed = false
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const problem = await check(url)
      if (problem === null) {
        console.log(`OK: ${url} serves a production bundle`)
        passed = true
        break
      }
      lastProblem = problem
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err)
    }
    if (attempt < ATTEMPTS) await Bun.sleep(RETRY_DELAY_MS)
  }
  if (!passed) failures.push(`${url}: ${lastProblem}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::smoke test failed — ${failure}`)
  process.exit(1)
}
