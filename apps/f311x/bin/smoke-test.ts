// Post-deploy gate: proves prod is serving a working production bundle instead
// of trusting deploy exit codes (which the alchemy CLI's hang-after-success
// makes unreliable -- see bin/deploy-prod.ts). The checks themselves live in
// bin/smoke-checks.ts and are shared with the pre-merge gate, bin/smoke-local.ts.
//
// Each URL gets several attempts to ride out DNS / edge propagation after a
// deploy. Override the targets and timing with SMOKE_URLS / SMOKE_ATTEMPTS /
// SMOKE_RETRY_DELAY_MS.

import {runSmoke} from './smoke-checks'

const urls = (
  process.env.SMOKE_URLS ??
  'https://f311x-website-prod-ddptpca6nyzpodvc.nullserve.workers.dev/,https://f311x.com/'
).split(',')
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 6)
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 10_000)

const failures = await runSmoke(urls, {attempts, retryDelayMs})

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::smoke test failed — ${failure}`)
  process.exit(1)
}
