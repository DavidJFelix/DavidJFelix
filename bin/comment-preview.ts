#!/usr/bin/env bun
// Upserts a single "sticky" PR comment with the preview URL and per-stage
// status (deploy, smoke, screenshots). Idempotent across pushes: scans ALL
// comment pages for the per-app marker, edits the first match, and deletes any
// duplicate markers left behind by earlier runs. Shared by every preview
// workflow -- the app-specific marker, heading, and teardown note come from
// PREVIEW_MARKER / PREVIEW_TITLE / PREVIEW_FOOTER; the stage outcomes come from
// PREVIEW_DEPLOY_OUTCOME / PREVIEW_SMOKE_OUTCOME / PREVIEW_E2E_OUTCOME (the
// steps' `outcome` values). The deployed-app link renders whenever the deploy
// step itself succeeded, so a failing smoke test or screenshot suite never
// hides the URL needed to investigate it. Uses the Actions-provided
// GITHUB_TOKEN (needs `pull-requests: write`).

export interface CommentBodyParams {
  marker: string
  title: string
  footer: string
  url: string | undefined
  deployOutcome: string | undefined
  smokeOutcome: string | undefined
  e2eOutcome: string | undefined
}

function stageStatus(outcome: string | undefined): string {
  if (outcome === 'success') return '✅ passed'
  if (outcome === 'failure') return '❌ failed'
  return '_skipped_'
}

export function buildCommentBody(params: CommentBodyParams): string {
  const {marker, title, footer, url, deployOutcome, smokeOutcome, e2eOutcome} = params
  // The link is keyed to the DEPLOY outcome alone: a deployed preview stays
  // linkable while smoke or screenshots fail, which is exactly when someone
  // needs to open it and see what is wrong.
  const preview =
    deployOutcome === 'success'
      ? (url ?? '_deployed, but no preview URL was captured — see the workflow logs_')
      : '_deploy failed — see the workflow logs_'
  return (
    `${marker}\n### ${title}\n\n` +
    `- Preview: ${preview}\n` +
    `- Smoke: ${stageStatus(smokeOutcome)}\n` +
    `- Screenshots: ${stageStatus(e2eOutcome)}\n\n` +
    `_${footer}_`
  )
}

type GhClient = (method: string, path: string, payload?: unknown) => Promise<unknown>

function makeGhClient(token: string): GhClient {
  return async (method, path, payload) => {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'preview-comment',
      },
      ...(payload === undefined ? {} : {body: JSON.stringify(payload)}),
    })
    if (!res.ok) {
      // A duplicate we're deleting may already be gone -- a concurrent same-app
      // run (racing us in the concurrency cancel window) or a manual delete. The
      // goal state, comment absent, is already met, so a DELETE 404 is a no-op
      // rather than an abort of the otherwise-idempotent cleanup.
      if (method === 'DELETE' && res.status === 404) return
      throw new Error(`GitHub API ${method} ${path} -> HTTP ${res.status} ${await res.text()}`)
    }
    // DELETE replies 204 No Content; don't try to parse an empty body as JSON.
    return res.status === 204 ? undefined : res.json()
  }
}

interface UpsertParams {
  gh: GhClient
  repo: string
  prNumber: string
  marker: string
  body: string
}

async function upsertStickyComment(params: UpsertParams): Promise<void> {
  const {gh, repo, prNumber, marker, body} = params

  // The list-issue-comments endpoint returns comments oldest-first with no sort
  // option, so we must walk every page: on a PR with >100 comments the sticky
  // comment falls off page 1, and reading only the first page would never find it
  // -- posting a fresh duplicate on every run. Collect all marker-bearing comments
  // across all pages instead.
  interface Comment {
    id: number
    body?: string
  }
  const marked: Comment[] = []
  for (let page = 1; ; page++) {
    const batch = (await gh(
      'GET',
      `/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
    )) as Comment[]
    marked.push(...batch.filter((c) => c.body?.includes(marker)))
    if (batch.length < 100) break
  }

  // Keep the oldest marked comment (stable position in the thread), edit it in
  // place, and delete the rest -- this fixes forward and cleans up duplicates that
  // earlier runs already posted.
  const [keep, ...duplicates] = marked
  for (const dup of duplicates) {
    await gh('DELETE', `/repos/${repo}/issues/comments/${dup.id}`)
  }
  if (keep) {
    await gh('PATCH', `/repos/${repo}/issues/comments/${keep.id}`, {body})
  } else {
    await gh('POST', `/repos/${repo}/issues/${prNumber}/comments`, {body})
  }

  const removed = duplicates.length
  console.log(
    `preview comment ${keep ? 'updated' : 'created'}${
      removed ? ` (removed ${removed} duplicate${removed > 1 ? 's' : ''})` : ''
    }`,
  )
}

if (import.meta.main) {
  await main()
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  // GITHUB_REPOSITORY is Actions-provided, owner/name.
  const repo = process.env.GITHUB_REPOSITORY
  const prNumber = process.env.PR_NUMBER
  const marker = process.env.PREVIEW_MARKER

  if (!token || !repo || !prNumber || !marker) {
    console.error(
      '::error::GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER and PREVIEW_MARKER are required',
    )
    process.exit(1)
  }

  const body = buildCommentBody({
    marker,
    title: process.env.PREVIEW_TITLE ?? 'Preview',
    footer:
      process.env.PREVIEW_FOOTER ??
      `Preview version \`pr-${prNumber}\`; replaced on each push, inert once this PR closes.`,
    url: process.env.PREVIEW_URL || undefined,
    deployOutcome: process.env.PREVIEW_DEPLOY_OUTCOME,
    smokeOutcome: process.env.PREVIEW_SMOKE_OUTCOME,
    e2eOutcome: process.env.PREVIEW_E2E_OUTCOME,
  })

  await upsertStickyComment({gh: makeGhClient(token), repo, prNumber, marker, body})
}
