import type {ChunkReviewStore} from './chunk-review-store'
import {decideOutcome, isAtLeast, REPORT_SEVERITY} from './findings'
import {type GitHubRequest, getPullRequest, listPullRequestFiles} from './github-api'
import type {Chat} from './openrouter'
import {completeCheckRun, createCheckRun, postReview, removeLabel} from './publish-review'
import {loadRepositorySnapshot} from './repository-snapshot'
import {RESOLVABLE_EXTERNAL_ID, syncCheckRunWithThreads} from './resolved-threads'
import {renderFileList} from './review-chunks'
import {
  type CheckRunOutput,
  formatCheckRunOutput,
  type NotReviewedFile,
  neutralizeMarkdown,
} from './review-markdown'
import {
  type ChunkReviewOutcome,
  mapWithConcurrency,
  planChunkReviews,
  reviewChunks,
  summarizeChunkReviews,
} from './review-pull-request'
import {REVIEWERS} from './reviewers'
import {OVER_LIMIT_REASON, selectReviewFiles} from './select-review-files'
import type {ReviewRunParams} from './webhook'

export interface StepAttempt {
  isLastAttempt: boolean
}

// Runs one durable step. When the Workflow instance restarts, a step that
// finished returns its saved result and does not run again.
export type RunStep = <Result extends Rpc.Serializable<Result>>(
  name: string,
  run: (attempt: StepAttempt) => Promise<Result>,
) => Promise<Result>

// Each chunk costs one chunk review for each reviewer, so a review covers at
// most this many chunks.
const MAX_REVIEWED_CHUNKS = 150

// Cloudflare keeps at most 1 MiB for each Workflow step result. The result of 3
// chunk reviews whose answers are at the finding limits is about 0.72 MiB.
const UNITS_PER_STEP = 3
const PARALLEL_STEPS = 6

const SUPERSEDED_OUTPUT: CheckRunOutput = {
  title: 'The pull request changed during the review',
  summary:
    'The pull request was closed or got a new head during the review, so this review posted nothing.',
}

export interface RunReviewParams extends ReviewRunParams {
  step: RunStep
  // Authenticated as the installation.
  request: GitHubRequest
  chat: Chat
  store: ChunkReviewStore
  model: string
}

export async function runReview({
  installationId,
  owner,
  name,
  pullNumber,
  headSha: eventHeadSha,
  label,
  step,
  request,
  chat,
  store,
  model,
}: RunReviewParams): Promise<void> {
  const repository = {owner, name}
  const pull = {request, repository, pullNumber}
  const openHeadSha = async () => {
    const state = await getPullRequest(pull)
    return state.open ? state.headSha : undefined
  }
  const started = await step('start', async () => {
    if (label !== undefined) {
      // The label only asks for a review. A failed removal does not stop it.
      await removeLabel({...pull, label}).catch((error: unknown) => {
        console.warn('Could not remove the review label', {error: String(error)})
      })
    }
    const currentSha = await openHeadSha()
    // A label asks for a review of the current head, which can be newer than
    // the head in the event.
    const headSha = label === undefined ? eventHeadSha : currentSha
    return headSha !== undefined && headSha === currentSha
      ? {headSha, checkRunId: await createCheckRun({request, repository, headSha})}
      : null
  })
  if (started === null) {
    return
  }
  const {headSha, checkRunId} = started
  const isCurrentHead = async () => (await openHeadSha()) === headSha
  const complete = (conclusion: 'success' | 'failure' | 'neutral', output: CheckRunOutput) =>
    completeCheckRun({request, repository, checkRunId, conclusion, output})
  try {
    const selection = await step('select files', async () => {
      const files = await listPullRequestFiles(pull)
      return {...selectReviewFiles(files), fileList: renderFileList(files)}
    })
    const planned = planChunkReviews({files: selection.files})
    const units = planned.slice(0, MAX_REVIEWED_CHUNKS * REVIEWERS.length)
    const notReviewed = [
      ...selection.notReviewed,
      ...uniquePaths(planned.slice(units.length).map(({chunk}) => chunk.path)).map(
        (path): NotReviewedFile => ({path, reason: OVER_LIMIT_REASON}),
      ),
    ]
    const loadSnapshot = memoize(() =>
      loadRepositorySnapshot({request, repository, commitSha: headSha}),
    )
    const batches = Array.from({length: Math.ceil(units.length / UNITS_PER_STEP)}, (_, index) =>
      units.slice(index * UNITS_PER_STEP, (index + 1) * UNITS_PER_STEP),
    )
    const batchOutcomes = await mapWithConcurrency({
      items: batches.map((batch, index) => ({batch, index})),
      limit: PARALLEL_STEPS,
      run: ({batch, index}) =>
        step(`review ${index + 1} of ${batches.length}`, async ({isLastAttempt}) => {
          if (!(await isCurrentHead())) {
            return null
          }
          const outcomes = await reviewChunks({
            units: batch,
            model,
            scope: `installation:${installationId}`,
            store,
            chat,
            fileList: selection.fileList,
            headSnapshot: await loadSnapshot(),
          })
          // The store keeps each answer that parsed, so a new attempt pays again
          // only for the reviews that failed or did not parse.
          const retryable = outcomes.filter((outcome) => outcome.retryable)
          if (retryable.length > 0 && !isLastAttempt) {
            throw new Error(
              `Retrying the step after ${retryable.length} of ${outcomes.length} chunk reviews failed: ${retryable[0].error}`,
            )
          }
          return outcomes.map(withReportedFindingsOnly)
        }),
    })
    const completed = batchOutcomes.filter((outcomes) => outcomes !== null)
    if (completed.length < batches.length) {
      await step('complete check run', () => complete('neutral', SUPERSEDED_OUTPUT))
      return
    }
    const review = summarizeChunkReviews({units, outcomes: completed.flat()})
    const outcome = decideOutcome(review.findings, {failedChunkReviewCount: review.failures.length})
    const posted = await step('post review', async () =>
      (await isCurrentHead()) ? postReview({...pull, headSha, findings: outcome.reported}) : null,
    )
    await step('complete check run', async () => {
      if (posted === null) {
        return complete('neutral', SUPERSEDED_OUTPUT)
      }
      const output = formatCheckRunOutput({outcome, review, notReviewed, postedCount: posted.count})
      // Resolved threads can clear a check that failed only on findings in
      // threads. The findings can all be in threads that a maintainer resolved
      // before this run, and a thread can be resolved during the run.
      const resolvable = outcome.failed && review.failures.length === 0 && posted.inline
      await completeCheckRun({
        request,
        repository,
        checkRunId,
        conclusion: outcome.failed ? 'failure' : 'success',
        output,
        ...(resolvable ? {externalId: RESOLVABLE_EXTERNAL_ID} : {}),
      })
      if (resolvable) {
        await syncCheckRunWithThreads(pull)
      }
    })
  } catch (error) {
    await step('report failure', () =>
      complete('failure', {
        title: 'The review failed',
        summary: neutralizeMarkdown(String(error).slice(0, 1000)),
      }),
    )
    throw error
  }
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)]
}

// Findings under the report severity are never posted. Dropping them keeps the
// step result small.
function withReportedFindingsOnly(outcome: ChunkReviewOutcome): ChunkReviewOutcome {
  return {
    ...outcome,
    findings: outcome.findings.filter(({severity}) =>
      isAtLeast({severity, threshold: REPORT_SEVERITY}),
    ),
  }
}

// Shares one load between calls, and loads again after a failure.
function memoize<Value>(load: () => Promise<Value>): () => Promise<Value> {
  let loaded: Promise<Value> | undefined
  return () => {
    loaded ??= load().catch((error: unknown) => {
      loaded = undefined
      throw error
    })
    return loaded
  }
}
