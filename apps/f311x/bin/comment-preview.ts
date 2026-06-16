// Upserts a single "sticky" PR comment with the preview URL and the smoke +
// screenshot status. Idempotent across pushes: finds a prior comment bearing the
// marker and edits it, else creates one. Uses the Actions-provided GITHUB_TOKEN
// (needs `pull-requests: write`).

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY // owner/name
const prNumber = process.env.PR_NUMBER
const url = process.env.PREVIEW_URL
const status = process.env.PREVIEW_STATUS ?? '⚠️ unknown'

if (!token || !repo || !prNumber) {
  console.error('::error::GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER are required')
  process.exit(1)
}

const MARKER = '<!-- f311x-preview -->'
const body =
  `${MARKER}\n### f311x preview\n\n` +
  (url ? `- Preview: ${url}\n` : '- Preview: _deploy failed — see the workflow logs_\n') +
  `- Smoke + screenshots: ${status}\n\n` +
  `_Stage \`pr-${prNumber}\`; torn down automatically when this PR closes._`

async function gh(method: string, path: string, payload?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'f311x-preview',
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
const existing = comments.find((c) => c.body?.includes(MARKER))

if (existing) {
  await gh('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, {body})
} else {
  await gh('POST', `/repos/${repo}/issues/${prNumber}/comments`, {body})
}
console.log('preview comment upserted')
