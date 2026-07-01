#!/usr/bin/env bun
// Upserts a single "sticky" PR comment with the preview URL and the smoke +
// screenshot status. Idempotent across pushes: scans ALL comment pages for the
// per-app marker, edits the first match, and deletes any duplicate markers left
// behind by earlier runs. Shared by every preview workflow -- the app-specific
// marker, heading, and teardown note come from PREVIEW_MARKER / PREVIEW_TITLE /
// PREVIEW_FOOTER. Uses the Actions-provided GITHUB_TOKEN (needs
// `pull-requests: write`).

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY // owner/name
const prNumber = process.env.PR_NUMBER
const url = process.env.PREVIEW_URL
const status = process.env.PREVIEW_STATUS ?? '⚠️ unknown'
const marker = process.env.PREVIEW_MARKER
const title = process.env.PREVIEW_TITLE ?? 'Preview'
const footer =
  process.env.PREVIEW_FOOTER ??
  `Preview version \`pr-${prNumber}\`; replaced on each push, inert once this PR closes.`

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
  `_${footer}_`

async function gh(method: string, path: string, payload?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'preview-comment',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${path} -> HTTP ${res.status} ${await res.text()}`)
  }
  // DELETE replies 204 No Content; don't try to parse an empty body as JSON.
  return res.status === 204 ? undefined : res.json()
}

// The list-issue-comments endpoint returns comments oldest-first with no sort
// option, so we must walk every page: on a PR with >100 comments the sticky
// comment falls off page 1, and reading only the first page would never find it
// -- posting a fresh duplicate on every run. Collect all marker-bearing comments
// across all pages instead.
type Comment = {id: number; body?: string}
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
