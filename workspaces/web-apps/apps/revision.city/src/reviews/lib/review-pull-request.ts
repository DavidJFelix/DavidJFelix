import {type ChunkReviewStore, chunkReviewKey} from './chunk-review-store'
import {
  anchorFindings,
  type Finding,
  type ModelFinding,
  modelAnswerSchema,
  modelFindingSchema,
} from './findings'
import {addUsage, type Chat, type CompletionUsage, extractJson, NO_USAGE} from './openrouter'
import {type RepositorySnapshot, readsStillMatch} from './repository-snapshot'
import {
  type ChunkPullRequestFilesOptions,
  chunkPullRequestFiles,
  type PullRequestFile,
  type ReviewChunk,
  renderChunk,
} from './review-chunks'
import {createReviewTools} from './review-tools'
import {buildSystemPrompt, REVIEWERS, type Reviewer} from './reviewers'
import {runToolLoop} from './tool-loop'

export interface ReviewChunkParams {
  chunk: ReviewChunk
  reviewer: Reviewer
  model: string
  store: ChunkReviewStore
  chat: Chat
  // With it, reviewers get tools that read files outside the chunk.
  headSnapshot?: RepositorySnapshot
}

export interface ChunkReviewOutcome {
  findings: Finding[]
  cached: boolean
  usage: CompletionUsage
  error?: string
}

export async function reviewChunk({
  chunk,
  reviewer,
  model,
  store,
  chat,
  headSnapshot,
}: ReviewChunkParams): Promise<ChunkReviewOutcome> {
  const rendered = renderChunk(chunk)
  const tools = headSnapshot === undefined ? undefined : createReviewTools(headSnapshot)
  const system = buildSystemPrompt({reviewer, withTools: tools !== undefined})
  const key = await chunkReviewKey({
    model,
    reviewerId: reviewer.id,
    systemPrompt: system,
    chunkText: rendered.text,
  })
  const anchor = (findings: readonly ModelFinding[]) =>
    anchorFindings({reviewerId: reviewer.id, chunk, rendered, findings})
  // The store only saves cost. When it fails, the chunk is reviewed anyway and
  // the failure does not fail the review.
  const saved = await store.get(key).catch(warnStoreFailure)
  if (saved && readsStillMatch(saved.reads, headSnapshot)) {
    return {findings: anchor(saved.findings), cached: true, usage: NO_USAGE}
  }
  const result = await runToolLoop({chat, model, system, prompt: rendered.text, tools})
  // reviewChunk saves only an answer that fully parses, so the next run asks
  // again after a failure. It still returns the usage of each model call before
  // the failure, because the provider bills those calls.
  if ('error' in result) {
    return {findings: [], cached: false, usage: result.usage, error: String(result.error)}
  }
  const answer = parseModelAnswer(result.text)
  if (answer.error !== undefined) {
    return {
      findings: anchor(answer.findings),
      cached: false,
      usage: result.usage,
      error: answer.error,
    }
  }
  await store
    .put(key, {findings: answer.findings, usage: result.usage, reads: result.reads})
    .catch(warnStoreFailure)
  return {findings: anchor(answer.findings), cached: false, usage: result.usage}
}

const STORE_FAILURE_LOG_MESSAGE = 'Chunk review store failed; the review continues without it'

function warnStoreFailure(error: unknown): undefined {
  console.warn(STORE_FAILURE_LOG_MESSAGE, {error: String(error)})
  return undefined
}

interface ParsedModelAnswer {
  findings: ModelFinding[]
  error?: string
}

function parseModelAnswer(text: string): ParsedModelAnswer {
  try {
    const answer = extractJson(text, modelAnswerSchema)
    const findings = answer.findings.flatMap((item) => {
      const parsed = modelFindingSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
    const malformedCount = answer.findings.length - findings.length
    return malformedCount > 0
      ? {findings, error: `Malformed findings in the answer: ${malformedCount}`}
      : {findings}
  } catch (error) {
    return {findings: [], error: String(error)}
  }
}

export interface ReviewPullRequestParams extends ChunkPullRequestFilesOptions {
  files: readonly PullRequestFile[]
  model: string
  store: ChunkReviewStore
  chat: Chat
  headSnapshot?: RepositorySnapshot
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

// One failed chunk does not stop the others; it is reported in `failures` and
// is not saved, so the next run tries it again.
export async function reviewPullRequest({
  files,
  model,
  store,
  chat,
  headSnapshot,
  reviewers = REVIEWERS,
  concurrency = 8,
  ...chunkOptions
}: ReviewPullRequestParams): Promise<PullRequestReview> {
  const units = chunkPullRequestFiles(files, chunkOptions).flatMap((chunk) =>
    reviewers.map((reviewer) => ({chunk, reviewer})),
  )
  const settled = await mapWithConcurrency({
    items: units,
    limit: concurrency,
    run: ({chunk, reviewer}) => reviewChunk({chunk, reviewer, model, store, chat, headSnapshot}),
  })
  const outcomes = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  )
  return {
    findings: outcomes.flatMap((outcome) => outcome.findings),
    failures: settled.flatMap((result, index) => {
      const error = result.status === 'rejected' ? String(result.reason) : result.value.error
      return error === undefined
        ? []
        : [{path: units[index].chunk.path, reviewerId: units[index].reviewer.id, error}]
    }),
    chunkReviewCount: units.length,
    cachedCount: outcomes.filter((outcome) => outcome.cached).length,
    usage: outcomes.map((outcome) => outcome.usage).reduce(addUsage, NO_USAGE),
  }
}

interface MapWithConcurrencyParams<Item, Result> {
  items: readonly Item[]
  limit: number
  run: (item: Item) => Promise<Result>
}

async function mapWithConcurrency<Item, Result>({
  items,
  limit,
  run,
}: MapWithConcurrencyParams<Item, Result>): Promise<PromiseSettledResult<Result>[]> {
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
  await Promise.all(Array.from({length: Math.min(Math.max(1, limit), items.length)}, worker))
  return results
}
