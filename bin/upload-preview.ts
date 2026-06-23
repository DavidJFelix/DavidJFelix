#!/usr/bin/env bun
// Per-PR preview deploy for the wrangler apps. Runs `wrangler versions upload
// --preview-alias pr-<N>`, which uploads a NON-ACTIVE version and exposes a
// deterministic preview URL `https://pr-<N>-<worker>.<subdomain>.workers.dev`.
// Crucially it does NOT apply triggers, so production routes / custom domains
// stay on the active version (safe for the custom-domain apps) and there is
// nothing to tear down. The URL is printed to stdout and, in Actions, appended
// to $GITHUB_OUTPUT as `url=...` for the smoke / screenshot / comment steps.
//
// The alias makes the URL deterministic, so unlike f311x's Alchemy stage there
// is no random worker suffix to resolve. We still read the account subdomain
// out of whatever *.workers.dev URL wrangler prints, then construct the alias
// URL -- no extra secret or API call needed.
//
// Run from the app directory (wrangler reads the app's wrangler.toml for the
// worker name + artifact location). WORKER_NAME must match that toml `name`.

import {appendFileSync} from 'node:fs'

// Build the deterministic alias URL from the account subdomain that appears in
// any *.workers.dev URL wrangler printed. Exported so the parsing is unit-
// testable without credentials or a real upload.
export function parsePreviewUrl(
  stdout: string,
  {prNumber, workerName}: {prNumber: string; workerName: string},
): string {
  // workers.dev hosts are always `<label>.<subdomain>.workers.dev`; capture the
  // subdomain (the label before `.workers.dev`).
  const match = stdout.match(/https:\/\/[a-z0-9-]+\.([a-z0-9-]+)\.workers\.dev/i)
  if (!match) {
    throw new Error(
      'no *.workers.dev preview URL found in wrangler output — is `preview_urls` enabled ' +
        '(and a workers.dev subdomain configured) for this worker?',
    )
  }
  return `https://pr-${prNumber}-${workerName}.${match[1]}.workers.dev/`
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
  if (!workerName) {
    console.error('::error::WORKER_NAME must be set to the wrangler.toml worker name')
    process.exit(1)
  }

  // Optional explicit wrangler config (relative to the app dir). Framework
  // adapters that emit a resolved config elsewhere set this -- e.g. djf.io's
  // @astrojs/cloudflare build writes dist/server/wrangler.json. Unset for the
  // plain `[assets]` apps, which deploy straight from their wrangler.toml.
  const config = process.env.WRANGLER_CONFIG

  // Test seam: exercise the upload/parse path without credentials, e.g.
  // UPLOAD_PREVIEW_TEST_CMD='echo https://abc-app.acct.workers.dev'.
  const cmd = process.env.UPLOAD_PREVIEW_TEST_CMD?.split(' ') ?? [
    'pnpm',
    'exec',
    'wrangler',
    'versions',
    'upload',
    ...(config ? ['-c', config] : []),
    '--preview-alias',
    `pr-${prNumber}`,
  ]

  const proc = Bun.spawn({cmd, stdout: 'pipe', stderr: 'inherit'})
  const stdout = await new Response(proc.stdout).text()
  process.stdout.write(stdout) // echo wrangler's output into the job log
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    console.error(`::error::wrangler versions upload failed with exit code ${exitCode}`)
    process.exit(exitCode)
  }

  let url: string
  try {
    url = parsePreviewUrl(stdout, {prNumber, workerName})
  } catch (err) {
    // A readable Actions annotation beats an uncaught bun stack trace. The most
    // likely cause is a worker without workers.dev Preview URLs enabled.
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
  console.log(url)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
  }
}
