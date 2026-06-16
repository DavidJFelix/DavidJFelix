// Pre-merge smoke gate: boots the *built* worker locally under workerd (via
// `wrangler dev`) and runs the same checks the post-deploy gate runs against
// prod. Because it serves the real production server bundle (dist/server) on the
// Workers runtime, it catches the "deployed but broken" class of failure -- a
// dead chat backend or a dev-mode bundle -- before merge, not after.
//
// Deterministic: the chat agent is an echo stub, so no credentials or model
// access are needed. Assumes `vite build` has run (the `smoke` mise task
// depends on `build`); compatibility settings are read from wrangler.toml so
// the local runtime matches the deployed one.

import {existsSync} from 'node:fs'
import wrangler from '../wrangler.toml'
import {runSmoke} from './smoke-checks'

const PORT = Number(process.env.SMOKE_PORT ?? 4311)
const BASE_URL = `http://127.0.0.1:${PORT}`
const WORKER = 'dist/server/server.js'
const ASSETS = 'dist/client'
const READY_TIMEOUT_MS = 60_000

if (!existsSync(WORKER)) {
  console.error(`::error::${WORKER} is missing -- run \`mise run build\` first`)
  process.exit(1)
}

const flags: Array<string> = wrangler.compatibility_flags ?? []
const worker = Bun.spawn(
  [
    'pnpm',
    'exec',
    'wrangler',
    'dev',
    WORKER,
    '--port',
    String(PORT),
    '--ip',
    '127.0.0.1',
    '--assets',
    ASSETS,
    '--compatibility-date',
    wrangler.compatibility_date,
    ...(flags.length > 0 ? ['--compatibility-flags', flags.join(',')] : []),
  ],
  {
    env: {...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false'},
    stdout: 'ignore',
    stderr: 'inherit',
  },
)

let exitCode = 0
try {
  const deadline = Date.now() + READY_TIMEOUT_MS
  let ready = false
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, {signal: AbortSignal.timeout(2_000)})
      if (res.ok) {
        ready = true
        break
      }
    } catch {
      // not up yet -- keep polling
    }
    await Bun.sleep(500)
  }

  if (!ready) {
    console.error(
      `::error::worker did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
    )
    exitCode = 1
  } else {
    // One real attempt locally -- there is no deployment propagation to wait
    // out -- plus a single retry to absorb a cold first request.
    const failures = await runSmoke([BASE_URL], {attempts: 2, retryDelayMs: 1_000})
    if (failures.length > 0) {
      for (const failure of failures) console.error(`::error::smoke test failed — ${failure}`)
      exitCode = 1
    } else {
      console.log('f311x local smoke passed')
    }
  }
} finally {
  worker.kill()
  await Promise.race([worker.exited, Bun.sleep(3_000)])
  worker.kill('SIGKILL')
}

process.exit(exitCode)
