import {type ChunkReviewStore, chunkReviewKey} from './chunk-review-store'
import {anchorFindings, type Finding, type ModelFinding, modelFindingsSchema} from './findings'
import {type Complete, type CompletionUsage, extractJson} from './openrouter'
import {
  type ChunkPullRequestFilesOptions,
  chunkPullRequestFiles,
  type PullRequestFile,
  type ReviewChunk,
  renderChunk,
} from './review-chunks'
import {buildSystemPrompt, REVIEWERS, type Reviewer} from './reviewers'

export interface ReviewChunkParams {
  chunk: ReviewChunk
  reviewer: Reviewer
  model: string
  store: ChunkReviewStore
  complete: Complete
}

export interface ChunkReviewOutcome {
  findings: Finding[]
  cached: boolean
  usage: CompletionUsage
}

const NO_USAGE: CompletionUsage = {promptTokens: 0, completionTokens: 0, costUsd: 0}

export async function reviewChunk({
  chunk,
  reviewer,
  model,
  store,
  complete,
}: ReviewChunkParams): Promise<ChunkReviewOutcome> {
  const rendered = renderChunk(chunk)
  const system = buildSystemPrompt(reviewer)
  const key = await chunkReviewKey({
    model,
    reviewerId: reviewer.id,
    systemPrompt: system,
    chunkText: rendered.text,
  })
  const saved = await store.get(key)
  const anchor = (findings: readonly ModelFinding[]) =>
    anchorFindings({reviewerId: reviewer.id, chunk, rendered, findings})
  if (saved) {
    return {findings: anchor(saved.findings), cached: true, usage: NO_USAGE}
  }
  const completion = await complete({model, system, prompt: rendered.text})
  // A response that fails to parse is thrown, not saved, so a retry asks again.
  const {findings} = modelFindingsSchema.parse(extractJson(completion.text))
  await store.put(key, {findings, usage: completion.usage})
  return {findings: anchor(findings), cached: false, usage: completion.usage}
}

export interface ReviewPullRequestParams extends ChunkPullRequestFilesOptions {
  files: readonly PullRequestFile[]
  model: string
  store: ChunkReviewStore
  complete: Complete
  reviewers?: readonly Reviewer[]
  concurrency?: number
}

export interface FailedChunkReview {
  path: string
  reviewerId: string
  error: string
}

export interface PullRequestReview {
  findings: Finding[]
  failures: FailedChunkReview[]
  chunkReviewCount: number
  cachedCount: number
  usage: CompletionUsage
}

// Reviews every chunk with every reviewer. One failed chunk does not stop the
// others; it is reported in `failures` and is not saved, so the next run tries
// it again.
export async function reviewPullRequest({
  files,
  model,
  store,
  complete,
  reviewers = REVIEWERS,
  concurrency = 8,
  maxLinesPerChunk,
}: ReviewPullRequestParams): Promise<PullRequestReview> {
  const units = chunkPullRequestFiles(files, {maxLinesPerChunk}).flatMap((chunk) =>
    reviewers.map((reviewer) => ({chunk, reviewer})),
  )
  const settled = await mapWithConcurrency(units, concurrency, ({chunk, reviewer}) =>
    reviewChunk({chunk, reviewer, model, store, complete}),
  )
  const outcomes = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  )
  return {
    findings: outcomes.flatMap((outcome) => outcome.findings),
    failures: settled.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            {
              path: units[index].chunk.path,
              reviewerId: units[index].reviewer.id,
              error: String(result.reason),
            },
          ]
        : [],
    ),
    chunkReviewCount: units.length,
    cachedCount: outcomes.filter((outcome) => outcome.cached).length,
    usage: outcomes.reduce(
      (total, {usage}) => ({
        promptTokens: total.promptTokens + usage.promptTokens,
        completionTokens: total.completionTokens + usage.completionTokens,
        costUsd: total.costUsd + usage.costUsd,
      }),
      NO_USAGE,
    ),
  }
}

async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  run: (item: Item) => Promise<Result>,
): Promise<PromiseSettledResult<Result>[]> {
  const results: PromiseSettledResult<Result>[] = Array.from({length: items.length})
  let nextIndex = 0
  const worker = async (): Promise<void> => {
    if (nextIndex >= items.length) {
      return
    }
    const index = nextIndex
    nextIndex += 1
    results[index] = await run(items[index]).then(
      (value) => ({status: 'fulfilled', value}) as const,
      (reason: unknown) => ({status: 'rejected', reason}) as const,
    )
    return worker()
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker))
  return results
}
