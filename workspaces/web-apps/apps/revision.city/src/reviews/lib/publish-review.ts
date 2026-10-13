// cSpell:ignore revisioncity -- the GitHub App's slug
import {z} from 'zod'
import {type Finding, SEVERITIES} from './findings'
import {
  GitHubApiError,
  type GitHubRepository,
  type GitHubRequest,
  listAllPages,
  type PullRequestParams,
  repositoryPath,
} from './github-api'
import {
  type CheckRunOutput,
  fingerprintFinding,
  formatFindingComment,
  formatReviewBody,
  readFingerprint,
} from './review-markdown'

export const CHECK_RUN_NAME = 'Revision City'

// The login on the app's own comments. One app serves every installation.
const APP_BOT_LOGIN = 'revisioncity[bot]'

// A review with more comments is hard to read. `postReview` does not post the
// rest, so the check run must list every finding.
const MAX_COMMENTS_PER_REVIEW = 50

// Reads at most 3000 review comments. On a pull request with more, a run can
// post a finding again.
const MAX_COMMENT_PAGES = 30

const ignoredResponse = z.unknown()

export interface CreateCheckRunParams {
  request: GitHubRequest
  repository: GitHubRepository
  headSha: string
}

export async function createCheckRun({
  request,
  repository,
  headSha,
}: CreateCheckRunParams): Promise<number> {
  const checkRun = await request({
    method: 'POST',
    path: `${repositoryPath(repository)}/check-runs`,
    body: {name: CHECK_RUN_NAME, head_sha: headSha, status: 'in_progress'},
    schema: z.object({id: z.number()}),
  })
  return checkRun.id
}

export interface CompleteCheckRunParams {
  request: GitHubRequest
  repository: GitHubRepository
  checkRunId: number
  conclusion: 'success' | 'failure' | 'neutral'
  output: CheckRunOutput
}

export async function completeCheckRun({
  request,
  repository,
  checkRunId,
  conclusion,
  output,
}: CompleteCheckRunParams): Promise<void> {
  await request({
    method: 'PATCH',
    path: `${repositoryPath(repository)}/check-runs/${checkRunId}`,
    body: {status: 'completed', conclusion, output},
    schema: ignoredResponse,
  })
}

export interface RemoveLabelParams extends PullRequestParams {
  label: string
}

export async function removeLabel({
  request,
  repository,
  pullNumber,
  label,
}: RemoveLabelParams): Promise<void> {
  await request({
    method: 'DELETE',
    path: `${repositoryPath(repository)}/issues/${pullNumber}/labels/${encodeURIComponent(label)}`,
    schema: ignoredResponse,
  })
}

const reviewCommentSchema = z.object({
  body: z.string(),
  path: z.string(),
  // Null when a push changes the lines and the comment becomes outdated.
  line: z.number().nullable(),
  user: z.object({login: z.string()}).nullable(),
})

export interface PostReviewParams extends PullRequestParams {
  headSha: string
  findings: readonly Finding[]
}

// Posts the findings that an earlier run did not post on the same line, at
// most `MAX_COMMENTS_PER_REVIEW` and most severe first. Returns how many it
// posted.
export async function postReview({
  request,
  repository,
  pullNumber,
  headSha,
  findings,
}: PostReviewParams): Promise<number> {
  const pullPath = `${repositoryPath(repository)}/pulls/${pullNumber}`
  const comments = await listAllPages({
    request,
    path: `${pullPath}/comments`,
    schema: reviewCommentSchema,
    maxPages: MAX_COMMENT_PAGES,
  })
  const postedKeys = new Set(
    comments.flatMap(({body, path, line, user}) => {
      const fingerprint = readFingerprint(body)
      return user?.login === APP_BOT_LOGIN && fingerprint !== undefined && line !== null
        ? [commentKey({fingerprint, path, line})]
        : []
    }),
  )
  const bySeverity = findings.toSorted(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  )
  const fingerprinted = await Promise.all(
    bySeverity.map(async (finding) => ({finding, fingerprint: await fingerprintFinding(finding)})),
  )
  const fresh = fingerprinted
    .filter(
      ({finding, fingerprint}) =>
        !postedKeys.has(commentKey({fingerprint, path: finding.path, line: finding.endLine})),
    )
    .slice(0, MAX_COMMENTS_PER_REVIEW)
  if (fresh.length === 0) {
    return 0
  }
  const freshFindings = fresh.map(({finding}) => finding)
  const review = {commit_id: headSha, event: 'COMMENT'}
  try {
    await request({
      method: 'POST',
      path: `${pullPath}/reviews`,
      body: {
        ...review,
        body: formatReviewBody({findings: freshFindings, inlineAccepted: true}),
        comments: fresh.map(({finding, fingerprint}) => ({
          path: finding.path,
          body: formatFindingComment(finding, fingerprint),
          side: 'RIGHT',
          line: finding.endLine,
          ...(finding.startLine < finding.endLine
            ? {start_line: finding.startLine, start_side: 'RIGHT'}
            : {}),
        })),
      },
      schema: ignoredResponse,
    })
  } catch (error) {
    // GitHub refuses the whole review when it cannot place one comment. The
    // body then lists the findings. A later run reads only inline comments, so
    // it posts them again.
    if (!(error instanceof GitHubApiError && error.status === 422)) {
      throw error
    }
    await request({
      method: 'POST',
      path: `${pullPath}/reviews`,
      body: {...review, body: formatReviewBody({findings: freshFindings, inlineAccepted: false})},
      schema: ignoredResponse,
    })
  }
  return fresh.length
}

interface CommentKeyParams {
  fingerprint: string
  path: string
  line: number
}

function commentKey({fingerprint, path, line}: CommentKeyParams): string {
  return JSON.stringify([fingerprint, path, line])
}
