#!/usr/bin/env bun
// Resolves a wrangler app's deterministic per-PR preview URL BEFORE the build,
// so the build can bake it in. The OpenGraph tags every app emits (og:url,
// og:image, the canonical link -- see workspaces/web-apps/packages/og) have to
// be absolute, and a preview whose tags named production would send scrapers
// to a card production does not serve yet. The alias URL is
// `https://pr-<N>-<worker>.<subdomain>.workers.dev/`, where only the account's
// workers.dev subdomain is unknown ahead of the upload; the Cloudflare API
// answers that with the same token the upload uses. The URL is printed to
// stdout and, in Actions, appended to $GITHUB_OUTPUT as `url=...`.
//
// bin/upload-preview.ts derives the same URL after the upload from wrangler's
// output; the two agree because both apply the alias formula to the account's
// one subdomain. A failed lookup is a warning, not a failure: the build then
// falls back to the app's canonical origin, which is what previews did before
// this script existed.

import {appendFileSync} from 'node:fs'

export interface PreviewUrlParams {
  prNumber: string
  workerName: string
  subdomain: string
}

export function previewUrl({prNumber, workerName, subdomain}: PreviewUrlParams): string {
  return `https://pr-${prNumber}-${workerName}.${subdomain}.workers.dev/`
}

export interface ResolveSubdomainParams {
  accountId: string
  apiToken: string
  // Test seam: the API call without credentials or a network.
  fetch?: typeof fetch
}

// GET /accounts/:id/workers/subdomain answers {result: {subdomain}}; the token
// that uploads worker versions can read it.
export async function resolveSubdomain({
  accountId,
  apiToken,
  fetch: fetchImpl = fetch,
}: ResolveSubdomainParams): Promise<string> {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    {headers: {authorization: `Bearer ${apiToken}`}},
  )
  const body = (await response.json()) as {
    success?: boolean
    result?: {subdomain?: string}
    errors?: unknown
  }
  if (!response.ok || !body.success || !body.result?.subdomain) {
    throw new Error(
      `Cloudflare API workers/subdomain -> HTTP ${response.status} ${JSON.stringify(body.errors ?? null)}`,
    )
  }
  return body.result.subdomain
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
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) {
    console.error(
      '::error::CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required to resolve the preview URL',
    )
    process.exit(1)
  }

  let subdomain: string
  try {
    subdomain = await resolveSubdomain({accountId, apiToken})
  } catch (error) {
    console.warn(
      '::warning::could not resolve the workers.dev subdomain, so this preview builds with its ' +
        `canonical origin in its absolute tags: ${error instanceof Error ? error.message : String(error)}`,
    )
    return
  }

  const url = previewUrl({prNumber, workerName, subdomain})
  console.log(url)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
  }
}
