import {expect, setSystemTime, test} from 'bun:test'
import {type AwaitReadyOptions, awaitReady, probeUrl} from './await-url-ready'

// awaitReady reads Date.now, which setSystemTime mocks; the injected sleep
// advances that mocked clock instead of actually sleeping (Bun fakes dates,
// not timers), so deadline behavior plays out instantly and deterministically.
// Resetting in finally keeps the mocked clock from leaking into other files.
async function runWithFakeTime(options: Omit<AwaitReadyOptions, 'sleep'>) {
  // Nonzero base: Bun treats epoch 0 as setSystemTime's "reset" sentinel and
  // silently ignores it, leaving Date.now real. With real time and no-op
  // sleeps the deadline loop degenerates into a memory-eating spin, so fail
  // fast if the mock ever stops taking effect.
  let t = 1_000_000
  setSystemTime(new Date(t))
  if (Date.now() !== t) throw new Error('setSystemTime did not mock Date.now')
  const sleep = (ms: number) => {
    t += ms
    setSystemTime(new Date(t))
    return Promise.resolve()
  }
  try {
    return await awaitReady({...options, sleep})
  } finally {
    setSystemTime()
  }
}

// Probe stub scripted per route path: each visit to a path consumes the next
// detail in its list, and the last entry repeats forever. 'HTTP 200' is a
// success, everything else a failure; unscripted paths always succeed.
function routeProbe(script: Record<string, Array<string>>) {
  const seen: Array<string> = []
  const visits = new Map<string, number>()
  const probe = (url: string) => {
    seen.push(url)
    const path = new URL(url).pathname
    const details = script[path] ?? ['HTTP 200']
    const visit = visits.get(path) ?? 0
    visits.set(path, visit + 1)
    const detail = details[Math.min(visit, details.length - 1)] ?? 'HTTP 200'
    return Promise.resolve({ok: detail === 'HTTP 200', detail})
  }
  return {probe, seen}
}

const base = {
  url: 'https://app-pr-1.acct.workers.dev/',
  routes: ['/'],
  deadlineMs: 60_000,
  consecutive: 3,
  intervalMs: 1_000,
  log: () => {},
}

test('ready once early 404s give way to consecutive successes', async () => {
  const {probe} = routeProbe({'/': ['HTTP 404', 'HTTP 404', 'HTTP 200']})

  const result = await runWithFakeTime({...base, probe})

  expect(result.ready).toBe(true)
  expect(result.rounds).toBe(5)
  expect(result.lastDetail).toBe('all 1 route(s) OK')
})

test('a flap after a success restarts the streak instead of counting toward it', async () => {
  const {probe} = routeProbe({'/': ['HTTP 200', 'HTTP 404', 'HTTP 200']})

  const result = await runWithFakeTime({...base, probe})

  // The 404 on round 2 reset the streak, so readiness needs the three fresh
  // 200s of rounds 3-5; had the pre-flap 200 counted, round 4 would have done.
  expect(result.ready).toBe(true)
  expect(result.rounds).toBe(5)
})

test('persistent 404 fails at the deadline with the failing route named', async () => {
  const {probe} = routeProbe({'/': ['HTTP 404']})

  const result = await runWithFakeTime({...base, deadlineMs: 5_000, probe})

  expect(result.ready).toBe(false)
  expect(result.rounds).toBe(5)
  expect(result.elapsedMs).toBe(5_000)
  expect(result.lastDetail).toBe('/ -> HTTP 404')
})

test('one stale route holds the gate even while the others serve', async () => {
  // The PR #341 failure shape: /chat serves immediately, but / keeps serving
  // a stale 404 (per-URL cache) for a while after deploy. The gate must not
  // report ready until every route serves.
  const {probe} = routeProbe({'/': ['HTTP 404', 'HTTP 404', 'HTTP 200'], '/chat': ['HTTP 200']})

  const result = await runWithFakeTime({...base, routes: ['/', '/chat'], probe})

  expect(result.ready).toBe(true)
  expect(result.rounds).toBe(5)
})

test('probes the exact bare route urls downstream checks will fetch', async () => {
  // No query-string cache-busting, no path rewriting: responses are cached
  // per full URL, so probing anything but the exact URL smoke and Playwright
  // fetch lets a stale per-URL 404 slip through the gate.
  const {probe, seen} = routeProbe({})

  await runWithFakeTime({...base, routes: ['/', '/chat'], probe})

  expect(new Set(seen)).toEqual(
    new Set(['https://app-pr-1.acct.workers.dev/', 'https://app-pr-1.acct.workers.dev/chat']),
  )
})

test('probeUrl treats a 2xx response as ready', async () => {
  const result = await probeUrl('https://example.workers.dev/', () =>
    Promise.resolve(new Response('ok')),
  )
  expect(result).toEqual({ok: true, detail: 'HTTP 200'})
})

test('probeUrl reports the status of a non-2xx response', async () => {
  const result = await probeUrl('https://example.workers.dev/', () =>
    Promise.resolve(new Response('error code: 404', {status: 404})),
  )
  expect(result).toEqual({ok: false, detail: 'HTTP 404'})
})

test('probeUrl reports a network failure as not ready instead of throwing', async () => {
  const result = await probeUrl('https://example.workers.dev/', () =>
    Promise.reject(new Error('connect ETIMEDOUT')),
  )
  expect(result).toEqual({ok: false, detail: 'connect ETIMEDOUT'})
})
