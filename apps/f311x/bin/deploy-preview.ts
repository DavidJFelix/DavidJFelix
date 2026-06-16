// Per-PR preview deploy for f311x. Deploys the Alchemy stack to a stage named
// pr-${PR_NUMBER}. Non-prod stages get no custom domain (alchemy.run.ts), so the
// worker is reachable only at its *.workers.dev URL. Alchemy names the worker
// f311x-website-<stage>-<random16>, where the suffix is persisted in state and
// can't be reconstructed offline -- so we resolve the URL from the Cloudflare
// API after deploy. The URL is printed to stdout and, in Actions, appended to
// $GITHUB_OUTPUT as `url=...` for the smoke / screenshot / comment steps.
//
// Tolerates the same hang-after-success failure mode as bin/deploy-prod.ts: a
// nonzero exit is a real failure; still-running at the deadline is presumed a
// hang, killed, and we proceed -- the smoke test against the resolved URL is
// the real gate.

import {appendFileSync} from 'node:fs'

const prNumber = process.env.PR_NUMBER
if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error('::error::PR_NUMBER must be set to the pull-request number')
  process.exit(1)
}
const stage = `pr-${prNumber}`
const DEADLINE_MS = 10 * 60 * 1000

// Test seam: exercise the timeout/failure/success paths without credentials
// (e.g. DEPLOY_PREVIEW_TEST_CMD='sleep 999').
const cmd = process.env.DEPLOY_PREVIEW_TEST_CMD?.split(' ') ?? [
  'pnpm',
  'exec',
  'alchemy',
  'deploy',
  '--stage',
  stage,
  '--yes',
]

const proc = Bun.spawn({cmd, stdout: 'inherit', stderr: 'inherit'})

let timedOut = false
const timer = setTimeout(() => {
  timedOut = true
  console.warn(
    `::warning::alchemy deploy still running after ${DEADLINE_MS / 60000} minutes — ` +
      'presumed hang-after-success (see bin/deploy-prod.ts header); killing it. ' +
      'The smoke test is the real gate.',
  )
  proc.kill('SIGKILL')
}, DEADLINE_MS)

const exitCode = await proc.exited
clearTimeout(timer)

if (!timedOut && exitCode !== 0) {
  console.error(`alchemy deploy failed with exit code ${exitCode}`)
  process.exit(exitCode)
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !apiToken) {
  console.error(
    '::error::CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required to resolve the preview URL',
  )
  process.exit(1)
}

const url = await resolvePreviewUrl(accountId, apiToken, stage)
console.log(url)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
}

async function cf(accountId: string, token: string, path: string): Promise<unknown> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    headers: {authorization: `Bearer ${token}`},
  })
  const json = (await res.json()) as {success: boolean; result: unknown; errors?: unknown}
  if (!res.ok || !json.success) {
    throw new Error(`Cloudflare API ${path} -> HTTP ${res.status} ${JSON.stringify(json.errors)}`)
  }
  return json.result
}

async function resolvePreviewUrl(accountId: string, token: string, stage: string): Promise<string> {
  // Worker names are lowercased: f311x-website-<stage>-<random16>.
  const prefix = `f311x-website-${stage}-`.toLowerCase()
  const scripts = (await cf(accountId, token, '/workers/scripts')) as Array<{id: string}>
  const match = scripts.find((s) => s.id.toLowerCase().startsWith(prefix))
  if (!match) {
    throw new Error(`no deployed worker found with prefix ${prefix}`)
  }
  const {subdomain} = (await cf(accountId, token, '/workers/subdomain')) as {subdomain: string}
  return `https://${match.id}.${subdomain}.workers.dev/`
}
