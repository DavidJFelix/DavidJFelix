import {type ChunkReviewStore, chunkReviewKey} from './chunk-review-store'
import {
  anchorFindings,
  type Finding,
  type ModelFinding,
  modelAnswerSchema,
  modelFindingSchema,
} from './findings'
import {
  addUsage,
  type Chat,
  type CompletionUsage,
  extractJson,
  findJsonSyntaxError,
  hasJsonObjectStart,
  NO_USAGE,
  OpenRouterError,
} from './openrouter'
import {selectGuides} from './repository-guides'
import {type RepositorySnapshot, readsStillMatch} from './repository-snapshot'
import {
  type ChunkPullRequestFilesOptions,
  chunkPullRequestFiles,
  type PullRequestFile,
  type ReviewChunk,
  renderChunk,
  renderFileList,
} from './review-chunks'
import {createReviewTools} from './review-tools'
import {buildSystemPrompt, REVIEWERS, type Reviewer} from './reviewers'
import {runToolLoop} from './tool-loop'

export interface ChunkReviewContext {
  model: string
  scope: string
  store: ChunkReviewStore
  chat: Chat
  // From renderPullRequestDescription.
  description: string
  fileList: string
  // From readGuides. Each chunk gets the guides that apply to its file.
  guides?: Readonly<Record<string, string>>
  // With it, reviewers get tools that read files outside the chunk.
  headSnapshot?: RepositorySnapshot
}

export interface ChunkReviewUnit {
  chunk: ReviewChunk
  reviewer: Reviewer
}

export interface ReviewChunkParams extends ChunkReviewContext, ChunkReviewUnit {}

export interface ChunkReviewOutcome {
  findings: Finding[]
  cached: boolean
  usage: CompletionUsage
  error?: string
  // True when a call failed and a new attempt can succeed, for example after a
  // network error. An answer that did not parse is not retryable.
  retryable?: boolean
}

export async function reviewChunk({
  chunk,
  reviewer,
  model,
  scope,
  store,
  chat,
  description,
  fileList,
  guides = {},
  headSnapshot,
}: ReviewChunkParams): Promise<ChunkReviewOutcome> {
  const rendered = renderChunk(chunk)
  const prompt = `${description}\n\n${fileList}\n\n${rendered.text}`
  const tools = headSnapshot === undefined ? undefined : createReviewTools(headSnapshot)
  const system = buildSystemPrompt({
    reviewer,
    withTools: tools !== undefined,
    guides: selectGuides({guides, path: chunk.path}),
  })
  const key = await chunkReviewKey({
    scope,
    model,
    reviewerId: reviewer.id,
    systemPrompt: system,
    prompt,
  })
  const anchor = (findings: readonly ModelFinding[]) =>
    anchorFindings({reviewerId: reviewer.id, chunk, rendered, findings})
  // The store only saves cost. When it fails, the chunk is reviewed anyway and
  // the failure does not fail the review.
  const saved = await store.get(key).catch(warnStoreFailure)
  if (saved && readsStillMatch(saved.reads, headSnapshot)) {
    return {findings: anchor(saved.findings), cached: true, usage: NO_USAGE}
  }
  const result = await runToolLoop({chat, model, system, prompt, tools})
  // reviewChunk saves only an answer that fully parses, so the next run asks
  // again after a failure. It still returns the usage of each model call before
  // the failure, because the provider bills those calls.
  if ('error' in result) {
    return {
      findings: [],
      cached: false,
      usage: result.usage,
      error: String(result.error),
      retryable: isRetryable(result.error),
    }
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

// An OpenRouter error that is not temporary, such as a bad key, happens again on
// a new attempt.
function isRetryable(error: unknown): boolean {
  return !(error instanceof OpenRouterError) || error.temporary
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
  } catch {
    return {findings: [], error: describeUnreadableAnswer(text)}
  }
}

// The check run shows the first `MAX_FAILURE_CHARS` characters of each failure, so
// the start and the end of the answer get 40 characters each. The two ends show
// the shape of the answer and whether it is cut off.
const ANSWER_END_CHARS = 40

function describeUnreadableAnswer(text: string): string {
  const reason = hasJsonObjectStart(text)
    ? (findJsonSyntaxError(text) ?? 'No findings list')
    : 'No JSON object'
  const excerpt =
    text.length <= 2 * ANSWER_END_CHARS
      ? `: ${JSON.stringify(text)}`
      : `. It starts with ${JSON.stringify(text.slice(0, ANSWER_END_CHARS))} and ends with ${JSON.stringify(text.slice(-ANSWER_END_CHARS))}`
  return `${reason}. The answer has ${text.length} characters${excerpt}.`
}

export interface PlanChunkReviewsParams extends ChunkPullRequestFilesOptions {
  files: readonly PullRequestFile[]
  reviewers?: readonly Reviewer[]
}

export function planChunkReviews({
  files,
  reviewers = REVIEWERS,
  ...chunkOptions
}: PlanChunkReviewsParams): ChunkReviewUnit[] {
  return chunkPullRequestFiles(files, chunkOptions).flatMap((chunk) =>
    reviewers.map((reviewer) => ({chunk, reviewer})),
  )
}

export interface ReviewChunksParams extends ChunkReviewContext {
  units: readonly ChunkReviewUnit[]
  concurrency?: number
}

// Returns one outcome per unit, in order. A unit that throws becomes an outcome
// with an error, so one failed chunk does not stop the others.
export async function reviewChunks({
  units,
  concurrency = 8,
  ...context
}: ReviewChunksParams): Promise<ChunkReviewOutcome[]> {
  return mapWithConcurrency({
    items: units,
    limit: concurrency,
    run: ({chunk, reviewer}) =>
      reviewChunk({chunk, reviewer, ...context}).catch((error: unknown): ChunkReviewOutcome => ({
        findings: [],
        cached: false,
        usage: NO_USAGE,
        error: String(error),
        retryable: isRetryable(error),
      })),
  })
}

export interface FailedChunkReview {
  path: string
  reviewerId: string
  error: string
}

export interface ChunkReviewCost {
  path: string
  // Set only when the file has more than one chunk. Counts from 1.
  part?: number
  reviewerId: string
  cached: boolean
  usage: CompletionUsage
}

export interface PullRequestReview {
  findings: Finding[]
  failures: FailedChunkReview[]
  chunkReviewCount: number
  cachedCount: number
  usage: CompletionUsage
  // One entry per chunk review, in the order of the units.
  costs: ChunkReviewCost[]
}

export interface SummarizeChunkReviewsParams {
  units: readonly ChunkReviewUnit[]
  // One outcome per unit, in the same order.
  outcomes: readonly ChunkReviewOutcome[]
}

export function summarizeChunkReviews({
  units,
  outcomes,
}: SummarizeChunkReviewsParams): PullRequestReview {
  if (outcomes.length !== units.length) {
    throw new Error(`Expected ${units.length} chunk review outcomes, got ${outcomes.length}`)
  }
  return {
    findings: outcomes.flatMap((outcome) => outcome.findings),
    failures: outcomes.flatMap(({error}, index) =>
      error === undefined
        ? []
        : [{path: units[index].chunk.path, reviewerId: units[index].reviewer.id, error}],
    ),
    chunkReviewCount: units.length,
    cachedCount: outcomes.filter((outcome) => outcome.cached).length,
    usage: outcomes.map((outcome) => outcome.usage).reduce(addUsage, NO_USAGE),
    costs: chunkReviewCosts({units, outcomes}),
  }
}

function chunkReviewCosts({units, outcomes}: SummarizeChunkReviewsParams): ChunkReviewCost[] {
  const chunks = [...new Set(units.map(({chunk}) => chunk))]
  return units.map(({chunk, reviewer}, index) => {
    const fileChunks = chunks.filter(({path}) => path === chunk.path)
    return {
      path: chunk.path,
      ...(fileChunks.length > 1 ? {part: fileChunks.indexOf(chunk) + 1} : {}),
      reviewerId: reviewer.id,
      cached: outcomes[index].cached,
      usage: outcomes[index].usage,
    }
  })
}

export interface ReviewPullRequestParams
  extends Omit<ChunkReviewContext, 'fileList'>, PlanChunkReviewsParams {
  concurrency?: number
}

// A failed chunk review goes into `failures`, and `reviewChunk` does not save
// it, so the next run tries it again.
export async function reviewPullRequest({
  files,
  reviewers,
  maxLinesPerChunk,
  maxPatchLinesPerFile,
  ...context
}: ReviewPullRequestParams): Promise<PullRequestReview> {
  const units = planChunkReviews({files, reviewers, maxLinesPerChunk, maxPatchLinesPerFile})
  const outcomes = await reviewChunks({units, fileList: renderFileList(files), ...context})
  return summarizeChunkReviews({units, outcomes})
}

interface MapWithConcurrencyParams<Item, Result> {
  items: readonly Item[]
  limit: number
  run: (item: Item) => Promise<Result>
}

export async function mapWithConcurrency<Item, Result>({
  items,
  limit,
  run,
}: MapWithConcurrencyParams<Item, Result>): Promise<Result[]> {
  const results: Result[] = Array.from({length: items.length})
  let nextIndex = 0
  // The map rejects when one item fails, so the workers then start no more
  // items. Each item can cost model calls.
  let failed = false
  const worker = async (): Promise<void> => {
    if (failed || nextIndex >= items.length) {
      return
    }
    const index = nextIndex
    nextIndex += 1
    results[index] = await run(items[index]).catch((error: unknown) => {
      failed = true
      throw error
    })
    return worker()
  }
  await Promise.all(Array.from({length: Math.min(Math.max(1, limit), items.length)}, worker))
  return results
}
