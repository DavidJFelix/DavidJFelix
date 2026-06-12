// Runs the prod deploy, tolerating exactly one failure mode: the alchemy
// beta.54 CLI completes its work and then never exits. Observed twice on
// 2026-06-11/12 — CI run 27387217212 printed "Done: 2 succeeded" then idled
// 14.5 minutes until the job timeout, and a local `alchemy deploy` did the
// same after uploading. No upstream issue exists yet (searched
// alchemy-run/alchemy 2026-06-12; closest lineage is PRs #770/#840 about
// dangling processes), so the evidence lives in those run logs.
//
// Policy: if alchemy exits nonzero on its own, that is a real failure and
// this script propagates it. If alchemy is still running at the deadline,
// we kill it and exit 0 with a warning — deliberately NOT trusting that
// silence means success. The smoke test (bin/smoke-test.ts) is the gate
// that decides whether the deploy actually shipped.

const DEADLINE_MS = 10 * 60 * 1000

// Test seam: lets the timeout/failure/success paths be exercised without
// credentials (e.g. DEPLOY_PROD_TEST_CMD='sleep 999').
const cmd = process.env.DEPLOY_PROD_TEST_CMD?.split(' ') ?? [
  'pnpm',
  'exec',
  'alchemy',
  'deploy',
  '--stage',
  'prod',
  '--yes',
]

const proc = Bun.spawn({cmd, stdout: 'inherit', stderr: 'inherit'})

// Bun's Subprocess.killed is true for any exited process, so track the
// deadline path explicitly.
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

if (timedOut) {
  process.exit(0)
}
if (exitCode !== 0) {
  console.error(`alchemy deploy failed with exit code ${exitCode}`)
  process.exit(exitCode)
}
