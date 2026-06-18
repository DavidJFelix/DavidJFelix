#!/usr/bin/env bun
// Upserts a single "sticky" PR comment with the preview URL and the smoke +
// screenshot status. Idempotent across pushes: finds a prior comment bearing the
// per-app marker and edits it, else creates one. Shared by every wrangler app's
// cd-preview workflow -- the app-specific marker and heading come from
// PREVIEW_MARKER / PREVIEW_TITLE. Uses the Actions-provided GITHUB_TOKEN (needs
// `pull-requests: write`). Generalized from apps/f311x/bin/comment-preview.ts.

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY // owner/name
const prNumber = process.env.PR_NUMBER
const url = process.env.PREVIEW_URL
const status = process.env.PREVIEW_STATUS ?? '⚠️ unknown'
const marker = process.env.PREVIEW_MARKER
const title = process.env.PREVIEW_TITLE ?? 'Preview'

if (!token || !repo || !prNumber || !marker) {
  console.error(
    '::error::GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER and PREVIEW_MARKER are required',
  )
  process.exit(1)
}

const body =
  `${marker}\n### ${title}\n\n` +
  (url ? `- Preview: ${url}\n` : '- Preview: _deploy failed — see the workflow logs_\n') +
  `- Smoke + screenshots: ${status}\n\n` +
  `_Preview version \`pr-${prNumber}\`; replaced on each push, inert once this PR closes._`

async function gh(method: string, path: string, payload?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'preview-wrangler',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${path} -> HTTP ${res.status} ${await res.text()}`)
  }
  return res.json()
}

const comments = (await gh(
  'GET',
  `/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
)) as Array<{id: number; body?: string}>
const existing = comments.find((c) => c.body?.includes(marker))

if (existing) {
  await gh('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, {body})
} else {
  await gh('POST', `/repos/${repo}/issues/${prNumber}/comments`, {body})
}
console.log('preview comment upserted')
