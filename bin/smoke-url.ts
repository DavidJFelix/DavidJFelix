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
// SMOKE_PROBES (optional) is a JSON list of requests that must answer one exact
// status, for example a route that must refuse an unsigned request. A probe
// sends no credential and never prints the response body.
//
// Usage: SMOKE_URL=https://pr-1-app.acct.workers.dev SMOKE_ROUTES=/,/about bun bin/smoke-url.ts
//
// A host behind Cloudflare Access needs CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
// (a service token) or every fetch lands on the login page -- reported as such,
// never as a passing 200. See bin/cloudflare-access.ts.

import {ACCESS_LOGIN_DETAIL, accessHeaders, isAccessLogin} from './cloudflare-access'

export type SmokeProbe = {
  readonly method: string
  readonly path: string
  readonly status: number
  // Text the response body must contain. The body itself is never printed.
  readonly bodyIncludes?: string
}

export type SmokeFetch = (url: URL, init: RequestInit) => Promise<Response>

export type CheckRouteParams = {
  readonly base: string
  readonly route: string
  readonly fetch: SmokeFetch
  readonly headers: Record<string, string>
}

// One route passes when it serves a complete HTML document whose first hashed
// client asset also serves -- the same contract every bin/smoke-local.ts uses,
// pointed at a remote URL. Returns the problem, or null on a pass.
export async function checkRoute({
  base,
  route,
  fetch,
  headers,
}: CheckRouteParams): Promise<string | null> {
  const page = await fetch(new URL(route, base), {signal: AbortSignal.timeout(15_000), headers})
  if (isAccessLogin(page)) {
    return `${route} -> ${ACCESS_LOGIN_DETAIL}`
  }
  if (!page.ok) {
    return `${route} -> HTTP ${page.status}`
  }
  const html = await page.text()
  if (!/<\/html>/i.test(html)) {
    return `${route} -> response is not a complete HTML document`
  }
  const asset = html.match(/(?:src|href)="(\/[^"]+\.(?:js|css))"/)?.[1]
  if (asset) {
    const res = await fetch(new URL(asset, base), {signal: AbortSignal.timeout(15_000), headers})
    if (!res.ok) {
      return `${route} asset ${asset} -> HTTP ${res.status}`
    }
  }
  return null
}

export type CheckProbeParams = {
  readonly base: string
  readonly probe: SmokeProbe
  readonly fetch: SmokeFetch
}

export const probeName = (probe: SmokeProbe): string => `${probe.method} ${probe.path}`

// Returns the problem, or null when the probe answers its exact status and,
// if set, its body contains `bodyIncludes`.
export async function checkProbe({base, probe, fetch}: CheckProbeParams): Promise<string | null> {
  const res = await fetch(new URL(probe.path, base), {
    method: probe.method,
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status !== probe.status) {
    return `${probeName(probe)} -> HTTP ${res.status}, wanted HTTP ${probe.status}`
  }
  if (probe.bodyIncludes !== undefined && !(await res.text()).includes(probe.bodyIncludes)) {
    return `${probeName(probe)} -> HTTP ${res.status} without the expected body text`
  }
  return null
}

export type RetryCheckParams = {
  readonly check: () => Promise<string | null>
  readonly attempts: number
  readonly retryDelayMs: number
  readonly sleep: (ms: number) => Promise<unknown>
}

// Runs `check` until it passes or the attempts run out. Returns null on a pass,
// else the last problem.
export async function retryCheck({
  check,
  attempts,
  retryDelayMs,
  sleep,
}: RetryCheckParams): Promise<string | null> {
  let lastProblem = 'unreachable'
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const problem = await check()
      if (problem === null) {
        return null
      }
      lastProblem = problem
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err)
    }
    if (attempt < attempts) {
      await sleep(retryDelayMs)
    }
  }
  return lastProblem
}

if (import.meta.main) {
  const base = process.env.SMOKE_URL
  if (!base) {
    console.error('::error::SMOKE_URL must be set to the base URL to smoke')
    process.exit(1)
  }
  const routes = (process.env.SMOKE_ROUTES ?? '/').split(',')
  const probes = JSON.parse(process.env.SMOKE_PROBES || '[]') as readonly SmokeProbe[]
  const retry = {
    attempts: Number(process.env.SMOKE_ATTEMPTS ?? 5),
    retryDelayMs: Number(process.env.SMOKE_RETRY_DELAY_MS ?? 5_000),
    sleep: Bun.sleep,
  }
  const headers = accessHeaders(process.env)

  const failures: Array<string> = []
  for (const route of routes) {
    const problem = await retryCheck({
      ...retry,
      check: () => checkRoute({base, route, fetch, headers}),
    })
    if (problem === null) {
      console.log(`OK: ${new URL(route, base)} serves a working bundle`)
    } else {
      failures.push(problem)
    }
  }
  for (const probe of probes) {
    const problem = await retryCheck({...retry, check: () => checkProbe({base, probe, fetch})})
    if (problem === null) {
      console.log(`OK: ${probeName(probe)} answers HTTP ${probe.status}`)
    } else {
      failures.push(problem)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error::smoke test failed — ${failure}`)
    }
    process.exit(1)
  }
  console.log(`all ${routes.length} route(s) serve a working bundle`)
  if (probes.length > 0) {
    console.log(`all ${probes.length} probe(s) answer as expected`)
  }
}
