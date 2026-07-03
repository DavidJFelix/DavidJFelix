#!/usr/bin/env bun
// Teardown for bin/deploy-preview-worker.ts: deletes the isolated `<worker>-pr-<N>`
// Worker when its PR closes. Uses the Cloudflare REST API directly (not
// `wrangler delete`) so the call is non-interactive, `force=true` removes the
// Worker's own Durable Object namespaces along with it, and a Worker that was
// never deployed (preview job failed or never ran) tears down as a no-op
// instead of failing the close event.

import {previewWorkerName} from './deploy-preview-worker'

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
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) {
    console.error('::error::CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
    process.exit(1)
  }

  // Only ever delete the per-PR naming pattern -- never a production Worker.
  const target = previewWorkerName(workerName, prNumber)

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${target}?force=true`,
    {method: 'DELETE', headers: {authorization: `Bearer ${apiToken}`}},
  )

  if (res.ok) {
    console.log(`deleted preview worker ${target}`)
    return
  }
  // 10007 = workers.api.error.script_not_found: the preview was never deployed
  // (or already deleted). A clean no-op, not a failure.
  const body = (await res.json().catch(() => null)) as {
    errors?: Array<{code?: number; message?: string}>
  } | null
  if (res.status === 404 || body?.errors?.some((e) => e.code === 10007)) {
    console.log(`preview worker ${target} does not exist -- nothing to tear down`)
    return
  }
  const detail = body?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? res.statusText
  console.error(`::error::failed to delete preview worker ${target} (HTTP ${res.status}) ${detail}`)
  process.exit(1)
}
