import {expect, test} from 'bun:test'
import {awaitReady, probeUrl} from './await-url-ready'

// Deterministic clock: sleep() is the only thing that advances time, so tests
// control exactly how the deadline plays out.
function fakeClock() {
  let t = 0
  return {
    now: () => t,
    sleep: (ms: number) => {
      t += ms
      return Promise.resolve()
    },
  }
}

// Probe stub that replays a scripted sequence of details; the last entry
// repeats forever. 'HTTP 200' is a success, everything else a failure.
function scriptedProbe(details: Array<string>) {
  const seen: Array<string> = []
  const probe = (url: string) => {
    seen.push(url)
    const detail = details[Math.min(seen.length - 1, details.length - 1)] ?? 'HTTP 200'
    return Promise.resolve({ok: detail === 'HTTP 200', detail})
  }
  return {probe, seen}
}

const base = {
  url: 'https://app-pr-1.acct.workers.dev/',
  deadlineMs: 60_000,
  consecutive: 3,
  intervalMs: 1_000,
  log: () => {},
}

test('ready once early 404s give way to consecutive successes', async () => {
  const clock = fakeClock()
  const {probe} = scriptedProbe(['HTTP 404', 'HTTP 404', 'HTTP 200', 'HTTP 200', 'HTTP 200'])

  const result = await awaitReady({...base, probe, ...clock})

  expect(result.ready).toBe(true)
  expect(result.probes).toBe(5)
  expect(result.lastDetail).toBe('HTTP 200')
})

test('a flap after a success restarts the streak instead of counting toward it', async () => {
  const clock = fakeClock()
  const {probe} = scriptedProbe(['HTTP 200', 'HTTP 404', 'HTTP 200', 'HTTP 200', 'HTTP 200'])

  const result = await awaitReady({...base, probe, ...clock})

  // The 404 on probe 2 reset the streak, so readiness needs the three fresh
  // 200s of probes 3-5; had the pre-flap 200 counted, probe 4 would have done.
  expect(result.ready).toBe(true)
  expect(result.probes).toBe(5)
})

test('persistent 404 fails at the deadline with the last result', async () => {
  const clock = fakeClock()
  const {probe} = scriptedProbe(['HTTP 404'])

  const result = await awaitReady({...base, deadlineMs: 5_000, probe, ...clock})

  expect(result.ready).toBe(false)
  expect(result.probes).toBe(5)
  expect(result.elapsedMs).toBe(5_000)
  expect(result.lastDetail).toBe('HTTP 404')
})

test('every probe carries a unique cache-busting query on the target url', async () => {
  const clock = fakeClock()
  const {probe, seen} = scriptedProbe(['HTTP 404', 'HTTP 200', 'HTTP 200', 'HTTP 200'])

  await awaitReady({...base, probe, ...clock})

  expect(new Set(seen).size).toBe(seen.length)
  for (const url of seen) {
    expect(url).toStartWith('https://app-pr-1.acct.workers.dev/?ready-probe=')
  }
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
