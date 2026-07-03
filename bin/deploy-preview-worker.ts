#!/usr/bin/env bun
// Per-PR preview deploy for wrangler apps whose Workers carry Durable Objects.
//
// `wrangler versions upload` (bin/upload-preview.ts) cannot carry DO migrations
// (Cloudflare error 10211: migrations need a non-versioned deployment), and a
// preview version of the production Worker would share production's DO storage
// anyway. So instead — following f311x's isolated-stage pattern — this deploys
// a SEPARATE Worker per PR: the app's built wrangler config with the name
// rewritten to `<worker>-pr-<N>`, custom-domain routes stripped, and workers.dev
// enabled. A fresh Worker takes a real `wrangler deploy`, so migrations apply
// cleanly and each preview gets its own isolated DO state. The counterpart
// bin/teardown-preview-worker.ts deletes the Worker when the PR closes.
//
// Run from the app directory. WRANGLER_CONFIG must point at the app's BUILT
// deployable config (e.g. dist-flue/onvibes_org/wrangler.json); the rewritten
// preview config is written next to it so relative paths (main, assets
// directory) keep resolving. The deployed *.workers.dev URL is printed to
// stdout and, in Actions, appended to $GITHUB_OUTPUT as `url=...`.

import {appendFileSync} from 'node:fs'
import {dirname, join} from 'node:path'

/** The per-PR Worker name; the teardown script must compute the same value. */
export function previewWorkerName(workerName: string, prNumber: string): string {
  return `${workerName}-pr-${prNumber}`
}

/**
 * Rewrite a built wrangler config into its isolated-preview shape: renamed
 * Worker, no production routes, workers.dev on. Everything else -- Durable
 * Objects, migrations, assets, bindings -- deploys as-is.
 */
export function buildPreviewConfig(
  config: Record<string, unknown>,
  {prNumber, workerName}: {prNumber: string; workerName: string},
): Record<string, unknown> {
  const preview = {...config}
  preview.name = previewWorkerName(workerName, prNumber)
  // Production custom domains must stay attached to the production Worker.
  delete preview.routes
  // The preview is reachable only at its workers.dev URL.
  preview.workers_dev = true
  return preview
}

/** Extract the deployed *.workers.dev URL from `wrangler deploy` output. */
export function parseDeployedUrl(stdout: string): string {
  const match = stdout.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i)
  if (!match) {
    throw new Error(
      'no *.workers.dev URL found in wrangler deploy output — is a workers.dev ' +
        'subdomain configured for this account?',
    )
  }
  return `${match[0]}/`
}

if (import.meta.main) {
  await main()
}

async function main(): Promise<void> {
  const prNumber = process.env.PR_NUMBER
  if (!prNumber || !/^\d+$/.test(prNumber)) {
    console.error('::error::PR_NUMBER must be set to the pull-request number')
    process.exit(1)
  }
  const workerName = process.env.WORKER_NAME
  if (!workerName || !/^[a-z0-9-]+$/.test(workerName)) {
    console.error('::error::WORKER_NAME must be set to the production worker name (kebab-case)')
    process.exit(1)
  }
  const configPath = process.env.WRANGLER_CONFIG
  if (!configPath) {
    console.error('::error::WRANGLER_CONFIG must point at the built deployable wrangler config')
    process.exit(1)
  }

  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    console.error(`::error::${configPath} is missing -- run the app's build first`)
    process.exit(1)
  }
  const preview = buildPreviewConfig(await file.json(), {prNumber, workerName})

  // Same directory as the built config so its relative paths keep resolving.
  const previewConfigPath = join(dirname(configPath), 'wrangler.preview.json')
  await Bun.write(previewConfigPath, `${JSON.stringify(preview, null, 2)}\n`)

  // Test seam: exercise the deploy/parse path without credentials, e.g.
  // DEPLOY_PREVIEW_WORKER_TEST_CMD='echo https://app-pr-1.acct.workers.dev'.
  const cmd = process.env.DEPLOY_PREVIEW_WORKER_TEST_CMD?.split(' ') ?? [
    'pnpm',
    'exec',
    'wrangler',
    'deploy',
    '-c',
    previewConfigPath,
  ]

  const proc = Bun.spawn({cmd, stdout: 'pipe', stderr: 'inherit'})
  const stdout = await new Response(proc.stdout).text()
  process.stdout.write(stdout) // echo wrangler's output into the job log
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    console.error(`::error::wrangler deploy failed with exit code ${exitCode}`)
    process.exit(exitCode)
  }

  let url: string
  try {
    url = parseDeployedUrl(stdout)
  } catch (err) {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
  console.log(url)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
  }
}
