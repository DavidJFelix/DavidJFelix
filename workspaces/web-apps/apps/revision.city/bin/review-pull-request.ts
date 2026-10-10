/// <reference types="bun" />
// Runs the review engine against a GitHub pull request from a terminal and
// prints what it would post, so its findings can be compared with another
// reviewer's on the same PR before the GitHub App posts anything.
//
// Usage: bun bin/review-pull-request.ts <owner>/<repo>#<number>
// Needs OPENROUTER_API_KEY and REVIEW_MODEL (an OpenRouter model slug).
// GITHUB_TOKEN is optional for public repositories. Saved results live only for
// this process, so every run pays for every chunk.

import {z} from 'zod'
import {createMemoryChunkReviewStore} from '../src/reviews/lib/chunk-review-store'
import {decideOutcome} from '../src/reviews/lib/findings'
import {createOpenRouterComplete} from '../src/reviews/lib/openrouter'
import type {PullRequestFile} from '../src/reviews/lib/review-chunks'
import {reviewPullRequest} from '../src/reviews/lib/review-pull-request'

const reference = /^([\w.-]+)\/([\w.-]+)#(\d+)$/.exec(process.argv[2] ?? '')
const {OPENROUTER_API_KEY, REVIEW_MODEL, GITHUB_TOKEN} = process.env
if (!reference || !OPENROUTER_API_KEY || !REVIEW_MODEL) {
  console.error(
    'Usage: OPENROUTER_API_KEY=... REVIEW_MODEL=... bun bin/review-pull-request.ts owner/repo#123',
  )
  process.exit(1)
}
const [, owner, repo, pullNumber] = reference

const pullRequestFilesSchema = z.array(
  z.object({
    filename: z.string(),
    status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']),
    patch: z.string().optional(),
  }),
)

async function fetchPullRequestFiles(page = 1): Promise<PullRequestFile[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
    {headers: GITHUB_TOKEN ? {authorization: `Bearer ${GITHUB_TOKEN}`} : {}},
  )
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}: ${await response.text()}`)
  }
  const batch = pullRequestFilesSchema.parse(await response.json())
  const files = batch.map(({filename, status, patch}) => ({path: filename, status, patch}))
  return batch.length < 100 ? files : [...files, ...(await fetchPullRequestFiles(page + 1))]
}

const review = await reviewPullRequest({
  files: await fetchPullRequestFiles(),
  model: REVIEW_MODEL,
  store: createMemoryChunkReviewStore(),
  complete: createOpenRouterComplete({apiKey: OPENROUTER_API_KEY}),
})
const outcome = decideOutcome(review.findings, {failedChunkReviewCount: review.failures.length})

for (const finding of outcome.reported) {
  const lines =
    finding.startLine === finding.endLine
      ? `${finding.endLine}`
      : `${finding.startLine}-${finding.endLine}`
  console.log(`\n[${finding.severity}] ${finding.path}:${lines} (${finding.reviewerId})`)
  console.log(`${finding.title}\n${finding.body}`)
}
for (const failure of review.failures) {
  console.error(`\nFailed: ${failure.path} (${failure.reviewerId}): ${failure.error}`)
}
console.log(
  `\n${outcome.failed ? 'FAIL' : 'PASS'}: ${outcome.reported.length} reported, ` +
    `${review.chunkReviewCount} chunk reviews, ${review.failures.length} failed, ` +
    `$${review.usage.costUsd.toFixed(4)}`,
)
process.exitCode = outcome.failed ? 1 : 0
