#!/usr/bin/env bun
// Readiness gate for freshly deployed *.workers.dev preview URLs. `wrangler
// deploy` returns once the Cloudflare API accepts the script, but a NEW
// hostname (a fresh `<worker>-pr-<N>` Worker, or a version preview alias on
// the PR's first upload) starts serving at the edge eventually -- and not
// monotonically: an early 200 can be followed by 404s from paths that have
// not converged yet. That gap made the preview pipelines flaky: one lucky 200
// in the smoke retries waved Playwright through into a still-flapping edge,
// and a plain rerun (hostname propagated by then) passed.
//
// Two hard-won rules shape this gate:
//
// 1. SUSTAINED success, not a bigger retry budget: readiness means N
//    consecutive all-routes-OK rounds spaced apart in time. A failure after a
//    success restarts the streak, so a single 200 never counts as ready.
// 2. Probe EXACTLY what downstream fetches. Responses are cached per full
//    URL, so a 404 cached during propagation can outlive it for that one URL
//    while the same worker serves every other URL fine (observed on PR #341:
//    /chat 200 while bare / served 404 for 25+ seconds -- yet cache-busted
//    probes of / returned 200 and waved the checks through). No query-string
//    busting, no special headers: the gate's job is to observe the reality
//    the smoke and screenshot checks are about to hit, not engineer around it.
//
// Downstream checks then never race propagation, so their failures always
// mean app bugs, never platform lag. A redeploy to an already-propagated
// hostname converges on the first rounds, in seconds.
//
// Usage: READY_URL=https://app-pr-1.acct.workers.dev READY_ROUTES=/,/chat \
//        bun bin/await-url-ready.ts

export interface Probe {
  ok: boolean
  detail: string
}

export interface AwaitReadyOptions {
  url: string
  routes: Array<string>
  deadlineMs: number
  consecutive: number
  intervalMs: number
  probe: (url: string) => Promise<Probe>
  sleep: (ms: number) => Promise<unknown>
  log: (line: string) => void
}

export interface AwaitReadyResult {
  ready: boolean
  rounds: number
  elapsedMs: number
  lastDetail: string
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * One readiness probe: does the URL currently serve a successful response?
 * A plain fetch on purpose -- same request shape as bin/smoke-url.ts and the
 * browser, so the gate sees the same (possibly cached) response they will.
 * Status-only, also on purpose: content correctness is the smoke test's job.
 */
export async function probeUrl(
  url: string,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Probe> {
  try {
    const res = await fetchImpl(url, {signal: AbortSignal.timeout(10_000)})
    return {ok: res.ok, detail: `HTTP ${res.status}`}
  } catch (err) {
    return {ok: false, detail: err instanceof Error ? err.message : String(err)}
  }
}

/**
 * Poll every route until one round has all of them OK `consecutive` times in
 * a row, `intervalMs` apart, or the deadline passes. Any route failing after
 * a good round is propagation flapping -- the streak restarts, because
 * "ready" means the edge serves every route consistently, not that each
 * served once.
 */
export async function awaitReady(options: AwaitReadyOptions): Promise<AwaitReadyResult> {
  const {url, routes, deadlineMs, consecutive, intervalMs, probe, sleep, log} = options
  const start = Date.now()
  let streak = 0
  let rounds = 0
  let lastDetail = 'never probed'
  while (Date.now() - start < deadlineMs) {
    const results = await Promise.all(
      routes.map(async route => ({route, ...(await probe(new URL(route, url).toString()))})),
    )
    rounds += 1
    const failures = results.filter(result => !result.ok)
    const detail =
      failures.length === 0
        ? `all ${routes.length} route(s) OK`
        : failures.map(failure => `${failure.route} -> ${failure.detail}`).join('; ')
    if (failures.length === 0) {
      if (streak === 0 && rounds > 1) {
        log(`first all-OK round after ${seconds(Date.now() - start)}`)
      }
      streak += 1
      if (streak >= consecutive) {
        return {ready: true, rounds, elapsedMs: Date.now() - start, lastDetail: detail}
      }
    } else {
      if (streak > 0) {
        log(
          `readiness flapped after ${streak} all-OK round(s): ${detail} at ` +
            `${seconds(Date.now() - start)} — restarting the streak`,
        )
      } else if (detail !== lastDetail) {
        log(`not ready (${detail}) at ${seconds(Date.now() - start)}`)
      }
      streak = 0
    }
    lastDetail = detail
    await sleep(intervalMs)
  }
  return {ready: false, rounds, elapsedMs: Date.now() - start, lastDetail}
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
  const routes = (process.env.READY_ROUTES ?? '/').split(',')
  const deadlineMs = Number(process.env.READY_DEADLINE_MS ?? 180_000)
  const consecutive = Number(process.env.READY_CONSECUTIVE ?? 4)
  const intervalMs = Number(process.env.READY_INTERVAL_MS ?? 3_000)

  console.log(
    `awaiting ${consecutive} consecutive all-OK rounds for ${routes.join(', ')} at ${url} ` +
      `(probing every ${seconds(intervalMs)}, deadline ${seconds(deadlineMs)})`,
  )
  const result = await awaitReady({
    url,
    routes,
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
        `(${result.rounds} rounds; last result: ${result.lastDetail}). A fresh ` +
        'workers.dev hostname that never converges usually means the deploy did ' +
        'not actually enable workers.dev for the worker, or Cloudflare routing ' +
        'is degraded.',
    )
    process.exit(1)
  }
  console.log(
    `ready: ${routes.length} route(s) sustained for ${consecutive} consecutive rounds, ` +
      `converged after ${seconds(result.elapsedMs)} (${result.rounds} rounds)`,
  )
}
