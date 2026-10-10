import {expect, test, vi} from 'vitest'
import {createMemoryChunkReviewStore} from './chunk-review-store'
import type {Complete} from './openrouter'
import type {PullRequestFile} from './review-chunks'
import {reviewPullRequest} from './review-pull-request'
import {REVIEWERS} from './reviewers'

const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const files = (start: number): PullRequestFile[] => [
  {path: 'a.ts', status: 'modified', patch: `@@ -${start},1 +${start},2 @@\n ctx\n+added`},
]

const answering = (text: string) => vi.fn<Complete>(async () => ({text, usage}))

test('reviewPullRequest runs every reviewer on every chunk and anchors findings', async () => {
  const complete = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    complete,
  })

  expect(complete).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(review.findings.map((finding) => [finding.reviewerId, finding.endLine])).toEqual(
    REVIEWERS.map((reviewer) => [reviewer.id, 6]),
  )
  expect(review.chunkReviewCount).toBe(REVIEWERS.length)
  expect(review.cachedCount).toBe(0)
  expect(review.usage.costUsd).toBeCloseTo(0.01 * REVIEWERS.length)
})

test('reviewPullRequest answers a re-run from saved results without calling the model', async () => {
  const store = createMemoryChunkReviewStore()
  const complete = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )
  await reviewPullRequest({files: files(5), model: 'vendor/model', store, complete})
  complete.mockClear()

  const review = await reviewPullRequest({files: files(40), model: 'vendor/model', store, complete})

  expect(complete).not.toHaveBeenCalled()
  expect(review.cachedCount).toBe(REVIEWERS.length)
  expect(review.usage.costUsd).toBe(0)
  // The chunk moved down the file; saved findings follow it.
  expect(review.findings.map((finding) => finding.endLine)).toEqual(REVIEWERS.map(() => 41))
})

test('reviewPullRequest reports a chunk the model answered badly and does not save it', async () => {
  const store = createMemoryChunkReviewStore()
  const complete = answering('not json')

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store,
    complete,
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.findings).toEqual([])
  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: 'security', error: 'Error: Model response has no JSON object'},
  ])
  // OpenRouter still bills a bad answer.
  expect(review.usage).toEqual(usage)
  complete.mockClear()
  await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store,
    complete,
    reviewers: REVIEWERS.slice(0, 1),
  })
  expect(complete).toHaveBeenCalledTimes(1)
})

test('reviewPullRequest reports a chunk whose model call failed', async () => {
  const complete = vi.fn<Complete>(async () => {
    throw new Error('OpenRouter returned 500')
  })

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    complete,
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: 'security', error: 'Error: OpenRouter returned 500'},
  ])
  expect(review.usage.costUsd).toBe(0)
})

test('reviewPullRequest makes no calls when no file is reviewable', async () => {
  const complete = answering('{"findings": []}')

  const review = await reviewPullRequest({
    files: [{path: 'bun.lock', status: 'modified', patch: '@@ -1 +1 @@\n+a'}],
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    complete,
  })

  expect(complete).not.toHaveBeenCalled()
  expect(review.chunkReviewCount).toBe(0)
})

test('reviewPullRequest still reviews every chunk when concurrency is below one', async () => {
  const complete = answering('{"findings": []}')

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    complete,
    concurrency: 0,
  })

  expect(complete).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(review.failures).toEqual([])
})
