#!/usr/bin/env bun
// Readiness gate for freshly deployed *.workers.dev preview URLs. `wrangler
// deploy` returns once the Cloudflare API accepts the script, but the edge
// route for a NEW hostname (a fresh `<worker>-pr-<N>` Worker, or a version
// preview alias on the PR's first upload) starts serving eventually -- and not
// monotonically: an early 200 can be followed by 404s from paths that have not
// converged yet. That gap made the preview pipelines flaky: one lucky 200 in
// the smoke retries waved Playwright through into a still-flapping edge, and a
// plain rerun (hostname propagated by then) passed.
//
// This gate turns the race into an event: poll the URL until it serves N
// CONSECUTIVE successes spaced apart in time (cache-busted so no intermediary
// can replay a pre-propagation miss), bounded by a hard deadline. Sustained
// success -- not a bigger retry budget -- is what non-monotonic propagation
// requires: a single 200 does not count as ready. Downstream checks then never
// race propagation, so their failures always mean app bugs, never platform
// lag. A redeploy to an already-propagated hostname converges on the first
// probes, in seconds.
//
// Usage: READY_URL=https://app-pr-1.acct.workers.dev bun bin/await-url-ready.ts

export interface Probe {
  ok: boolean
  detail: string
}

export interface AwaitReadyOptions {
  url: string
  deadlineMs: number
  consecutive: number
  intervalMs: number
  probe: (url: string) => Promise<Probe>
  sleep: (ms: number) => Promise<unknown>
  log: (line: string) => void
}

export interface AwaitReadyResult {
  ready: boolean
  probes: number
  elapsedMs: number
  lastDetail: string
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * One readiness probe: does the URL currently serve a successful response?
 * Status-only on purpose -- content correctness is the smoke test's job; this
 * gate only asks whether the edge routes requests to the worker at all.
 */
export async function probeUrl(
  url: string,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Probe> {
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(10_000),
      // Ask intermediaries not to serve a response cached before propagation.
      headers: {'cache-control': 'no-cache'},
    })
    return {ok: res.ok, detail: `HTTP ${res.status}`}
  } catch (err) {
    return {ok: false, detail: err instanceof Error ? err.message : String(err)}
  }
}

/**
 * Poll until the URL serves `consecutive` successes in a row, `intervalMs`
 * apart, or the deadline passes. A failure after a success is propagation
 * flapping -- the streak restarts, because "ready" means the edge serves the
 * worker consistently, not that it did so once.
 */
export async function awaitReady(options: AwaitReadyOptions): Promise<AwaitReadyResult> {
  const {url, deadlineMs, consecutive, intervalMs, probe, sleep, log} = options
  const start = Date.now()
  let streak = 0
  let probes = 0
  let lastDetail = 'never probed'
  while (Date.now() - start < deadlineMs) {
    // A unique query string per probe defeats any cached miss on the path.
    const target = new URL(url)
    target.searchParams.set('ready-probe', String(probes))
    const result = await probe(target.toString())
    probes += 1
    if (result.ok) {
      if (streak === 0 && probes > 1) {
        log(`first success after ${seconds(Date.now() - start)} (${result.detail})`)
      }
      streak += 1
      if (streak >= consecutive) {
        return {ready: true, probes, elapsedMs: Date.now() - start, lastDetail: result.detail}
      }
    } else {
      if (streak > 0) {
        log(
          `readiness flapped after ${streak} success(es): ${result.detail} at ` +
            `${seconds(Date.now() - start)} — restarting the streak`,
        )
      } else if (result.detail !== lastDetail) {
        log(`not ready (${result.detail}) at ${seconds(Date.now() - start)}`)
      }
      streak = 0
    }
    lastDetail = result.detail
    await sleep(intervalMs)
  }
  return {ready: false, probes, elapsedMs: Date.now() - start, lastDetail}
}

if (import.meta.main) {
  await main()
}

async function main(): Promise<void> {
  const url = process.env.READY_URL
  if (!url) {
    console.error('::error::READY_URL must be set to the deployed URL to await')
    process.exit(1)
  }
  const deadlineMs = Number(process.env.READY_DEADLINE_MS ?? 180_000)
  const consecutive = Number(process.env.READY_CONSECUTIVE ?? 4)
  const intervalMs = Number(process.env.READY_INTERVAL_MS ?? 3_000)

  console.log(
    `awaiting ${consecutive} consecutive successes from ${url} ` +
      `(probing every ${seconds(intervalMs)}, deadline ${seconds(deadlineMs)})`,
  )
  const result = await awaitReady({
    url,
    deadlineMs,
    consecutive,
    intervalMs,
    probe: probeUrl,
    sleep: Bun.sleep,
    log: console.log,
  })
  if (!result.ready) {
    console.error(
      `::error::${url} still not ready after ${seconds(result.elapsedMs)} ` +
        `(${result.probes} probes; last result: ${result.lastDetail}). A fresh ` +
        'workers.dev hostname that never converges usually means the deploy did ' +
        'not actually enable workers.dev for the worker, or Cloudflare routing ' +
        'is degraded.',
    )
    process.exit(1)
  }
  console.log(
    `ready: ${result.lastDetail} sustained for ${consecutive} consecutive probes, ` +
      `converged after ${seconds(result.elapsedMs)} (${result.probes} probes)`,
  )
}
