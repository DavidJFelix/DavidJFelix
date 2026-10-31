/// <reference types="bun" />
// Runs the review engine on a GitHub pull request and prints the findings that
// the GitHub App would post. Use it to compare those findings with another
// reviewer's on the same PR.
//
// Usage: bun bin/review-pull-request.ts <owner>/<repo>#<number>
// Needs OPENROUTER_API_KEY and REVIEW_MODEL (an OpenRouter model slug that
// supports tool calls). GITHUB_TOKEN is optional for public repositories, but
// without it GitHub allows 60 requests an hour, which the reviewers' file reads
// soon use up. Saved results live only for this process, so every run pays
// for every chunk.

import {createMemoryChunkReviewStore} from '../src/reviews/lib/chunk-review-store'
import {decideOutcome} from '../src/reviews/lib/findings'
import {
  createGitHubRequest,
  getPullRequest,
  getPullRequestDetails,
  listPullRequestFiles,
} from '../src/reviews/lib/github-api'
import {createOpenRouterChat} from '../src/reviews/lib/openrouter'
import {readBaseGuides} from '../src/reviews/lib/repository-guides'
import {loadRepositorySnapshot} from '../src/reviews/lib/repository-snapshot'
import {fileReviewStatus, renderPullRequestDescription} from '../src/reviews/lib/review-chunks'
import {reviewPullRequest} from '../src/reviews/lib/review-pull-request'

const reference = /^([\w.-]+)\/([\w.-]+)#(\d+)$/.exec(process.argv[2] ?? '')
const {OPENROUTER_API_KEY, REVIEW_MODEL, GITHUB_TOKEN} = process.env
if (!reference || !OPENROUTER_API_KEY || !REVIEW_MODEL) {
  console.error(
    'Usage: OPENROUTER_API_KEY=... REVIEW_MODEL=... bun bin/review-pull-request.ts owner/repo#123',
  )
  process.exit(1)
}
const [, owner, name, pullNumberText] = reference
const repository = {owner, name}
const pullNumber = Number(pullNumberText)

const request = createGitHubRequest({token: GITHUB_TOKEN ? async () => GITHUB_TOKEN : undefined})
const pull = await getPullRequest({request, repository, pullNumber})
const files = await listPullRequestFiles({request, repository, pullNumber})
const details = await getPullRequestDetails({request, repository, pullNumber})
const snapshot = await loadRepositorySnapshot({request, repository, commitSha: pull.headSha})
if (!snapshot) {
  console.error('The repository tree is too large to load, so the reviewers run without tools.')
}

const review = await reviewPullRequest({
  files,
  model: REVIEW_MODEL,
  scope: 'local',
  store: createMemoryChunkReviewStore(),
  chat: createOpenRouterChat({apiKey: OPENROUTER_API_KEY}),
  description: renderPullRequestDescription(details),
  guides: details.baseIsDefaultBranch
    ? await readBaseGuides({
        request,
        repository,
        baseSha: details.baseSha,
        paths: files.map(({path}) => path),
      })
    : {},
  headSnapshot: snapshot,
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
for (const file of files) {
  const status = fileReviewStatus(file)
  if (status === 'no-text-diff' || status === 'too-large') {
    console.error(`Not reviewed (${status}): ${file.path}`)
  }
}
console.log(
  `\n${outcome.failed ? 'FAIL' : 'PASS'}: ${outcome.reported.length} reported, ` +
    `${outcome.unchecked.length} not checked, ` +
    `${review.chunkReviewCount} chunk reviews, ${review.failures.length} failed, ` +
    `$${review.usage.costUsd.toFixed(4)}`,
)
process.exitCode = outcome.failed ? 1 : 0
