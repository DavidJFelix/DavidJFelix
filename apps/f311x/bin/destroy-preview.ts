// Tears down a per-PR preview stage (alchemy destroy --stage pr-${PR_NUMBER}),
// run when the PR closes. Best-effort: a missing stage or a hang-after-success
// must not fail the teardown job, so a nonzero/late exit is warned, not
// propagated. A leaked preview worker is harmless and re-running cleans it up.

const prNumber = process.env.PR_NUMBER
if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error('::error::PR_NUMBER must be set to the pull-request number')
  process.exit(1)
}
const stage = `pr-${prNumber}`
const DEADLINE_MS = 5 * 60 * 1000

// Test seam: see bin/deploy-preview.ts.
const cmd = process.env.DESTROY_PREVIEW_TEST_CMD?.split(' ') ?? [
  'pnpm',
  'exec',
  'alchemy',
  'destroy',
  '--stage',
  stage,
  '--yes',
]

const proc = Bun.spawn({cmd, stdout: 'inherit', stderr: 'inherit'})

const timer = setTimeout(() => {
  console.warn(
    `::warning::alchemy destroy still running after ${DEADLINE_MS / 60000} minutes — killing it.`,
  )
  proc.kill('SIGKILL')
}, DEADLINE_MS)

const exitCode = await proc.exited
clearTimeout(timer)

if (exitCode !== 0) {
  console.warn(
    `::warning::alchemy destroy exited ${exitCode} for stage ${stage}; ` +
      'the preview may need manual cleanup (re-run this job or `alchemy destroy`).',
  )
}
process.exit(0)
