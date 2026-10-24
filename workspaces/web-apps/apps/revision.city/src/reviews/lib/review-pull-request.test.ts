import {expect, test, vi} from 'vitest'
import {createMemoryChunkReviewStore} from './chunk-review-store'
import {type Chat, OpenRouterError} from './openrouter'
import type {RepositoryEntry, RepositorySnapshot} from './repository-snapshot'
import type {PullRequestFile} from './review-chunks'
import {
  mapWithConcurrency,
  planChunkReviews,
  reviewChunks,
  reviewPullRequest,
  summarizeChunkReviews,
} from './review-pull-request'
import {REVIEWERS} from './reviewers'

const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const files = (start: number): PullRequestFile[] => [
  {path: 'a.ts', status: 'modified', patch: `@@ -${start},1 +${start},2 @@\n ctx\n+added`},
]

const answering = (content: string) => vi.fn<Chat>(async () => ({content, toolCalls: [], usage}))

test('reviewPullRequest runs every reviewer on every chunk and anchors findings', async () => {
  const chat = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
  })

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(review.findings.map((finding) => [finding.reviewerId, finding.endLine])).toEqual(
    REVIEWERS.map((reviewer) => [reviewer.id, 6]),
  )
  expect(review.chunkReviewCount).toBe(REVIEWERS.length)
  expect(review.cachedCount).toBe(0)
  expect(review.usage.costUsd).toBeCloseTo(0.01 * REVIEWERS.length)
})

test('reviewPullRequest answers a re-run from saved results without calling the model', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )
  await reviewPullRequest({files: files(5), model: 'vendor/model', store, scope: 'test', chat})
  chat.mockClear()

  const review = await reviewPullRequest({
    files: files(40),
    model: 'vendor/model',
    store,
    scope: 'test',
    chat,
  })

  expect(chat).not.toHaveBeenCalled()
  expect(review.cachedCount).toBe(REVIEWERS.length)
  expect(review.usage.costUsd).toBe(0)
  // The chunk moved down the file; saved findings follow it.
  expect(review.findings.map((finding) => finding.endLine)).toEqual(REVIEWERS.map(() => 41))
})

test('reviewPullRequest sends the list of changed files before the chunk', async () => {
  const chat = answering('{"findings": []}')

  await reviewPullRequest({
    files: [
      ...files(5),
      {path: 'bun.lock', status: 'modified', patch: '@@ -1,1 +1,1 @@\n-a\n+b'},
      {path: 'old.ts', status: 'removed'},
    ],
    reviewers: REVIEWERS.slice(0, 1),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
  })

  expect(chat).toHaveBeenCalledTimes(1)
  expect(chat.mock.calls[0][0].messages[1]).toEqual({
    role: 'user',
    content: [
      'Files that the pull request changes:',
      '- a.ts (modified)',
      '- bun.lock (modified)',
      '- old.ts (removed)',
      '',
      'File: a.ts',
      '',
      '    1   ctx',
      '    2 + added',
    ].join('\n'),
  })
})

test('reviewPullRequest reviews each chunk again when a push adds a file', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering('{"findings": []}')
  await reviewPullRequest({files: files(5), model: 'vendor/model', store, scope: 'test', chat})
  chat.mockClear()

  const review = await reviewPullRequest({
    files: [...files(5), {path: 'b.md', status: 'added', patch: '@@ -0,0 +1,1 @@\n+b'}],
    model: 'vendor/model',
    store,
    scope: 'test',
    chat,
  })

  expect(review.cachedCount).toBe(0)
  expect(chat).toHaveBeenCalledTimes(2 * REVIEWERS.length)
})

test('reviewPullRequest reports a chunk the model answered badly and does not save it', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering('not json')

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store,
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.findings).toEqual([])
  expect(review.failures).toEqual([
    {
      path: 'a.ts',
      reviewerId: 'security',
      error: 'No JSON object. The answer has 8 characters: "not json".',
    },
  ])
  // OpenRouter still bills a bad answer.
  expect(review.usage).toEqual(usage)
  chat.mockClear()
  await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store,
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })
  expect(chat).toHaveBeenCalledTimes(1)
})

test.each([
  {
    name: 'the JSON error and both ends of an answer that is cut off',
    answer:
      '{"findings": [{"severity": "medium", "title": "Bug", "body": "Breaks", "label": 2}, {"severity": "high", "title": "Cut',
    error: String.raw`SyntaxError: Unterminated string in JSON at position 118 (line 1 column 119). The answer has 118 characters. It starts with "{\"findings\": [{\"severity\": \"medium\", \"ti" and ends with ": 2}, {\"severity\": \"high\", \"title\": \"Cut".`,
  },
  {
    name: 'both ends of a JSON answer with no findings list',
    answer:
      '{"name": "read_file", "arguments": {"path": "workspaces/web-apps/apps/revision.city/src/index.ts"}}',
    error: String.raw`No findings list. The answer has 99 characters. It starts with "{\"name\": \"read_file\", \"arguments\": {\"pat" and ends with "-apps/apps/revision.city/src/index.ts\"}}".`,
  },
  {
    name: 'a missing findings list when a brace in prose comes before the JSON',
    answer: 'Use {x}. {"name": "read_file"}',
    error: String.raw`No findings list. The answer has 30 characters: "Use {x}. {\"name\": \"read_file\"}".`,
  },
  {
    name: 'no JSON object when the only braces are in prose',
    answer: 'No problems in {x}.',
    error: 'No JSON object. The answer has 19 characters: "No problems in {x}.".',
  },
])('reviewPullRequest reports $name', async ({answer, error}) => {
  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat: answering(answer),
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.failures).toEqual([{path: 'a.ts', reviewerId: 'security', error}])
})

test('reviewPullRequest reads the answer after other JSON that the model quotes', async () => {
  const chat = answering(
    'The file has {"type": "module"}. {"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.failures).toEqual([])
  expect(review.findings.map((finding) => finding.endLine)).toEqual([6])
})

test('reviewPullRequest keeps the valid findings of an answer with a malformed one', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}, {"severity": "high", "title": "", "body": "No title", "label": 0}]}',
  )
  const options = {
    files: files(5),
    model: 'vendor/model',
    scope: 'test',
    store,
    reviewers: REVIEWERS.slice(0, 1),
  }

  const review = await reviewPullRequest({...options, chat})

  expect(review.findings.map((finding) => finding.endLine)).toEqual([6])
  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: 'security', error: 'Malformed findings in the answer: 1'},
  ])
  chat.mockClear()
  await reviewPullRequest({...options, chat})
  expect(chat).toHaveBeenCalledTimes(1)
})

test('reviewPullRequest reviews and reports findings when the store fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const chat = answering(
    '{"findings": [{"severity": "high", "title": "Bug", "body": "Breaks", "label": 2}]}',
  )

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: {
      get: async () => Promise.reject(new Error('D1 read failed')),
      put: async () => Promise.reject(new Error('D1 write failed')),
    },
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.findings.map((finding) => finding.endLine)).toEqual([6])
  expect(review.failures).toEqual([])
  expect(review.usage).toEqual(usage)
  expect(warn).toHaveBeenCalledTimes(2)
  warn.mockRestore()
})

test('reviewPullRequest reports a chunk whose model call failed', async () => {
  const chat = vi.fn<Chat>(async () => {
    throw new Error('OpenRouter returned 500')
  })

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
  })

  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: 'security', error: 'Error: OpenRouter returned 500'},
  ])
  expect(review.usage.costUsd).toBe(0)
})

test('reviewPullRequest makes no calls when no file is reviewable', async () => {
  const chat = answering('{"findings": []}')

  const review = await reviewPullRequest({
    files: [{path: 'bun.lock', status: 'modified', patch: '@@ -1 +1 @@\n+a'}],
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
  })

  expect(chat).not.toHaveBeenCalled()
  expect(review.chunkReviewCount).toBe(0)
})

test('reviewPullRequest does not review a file over the line limit the caller sets', async () => {
  const chat = answering('{"findings": []}')

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    maxPatchLinesPerFile: 2,
  })

  expect(chat).not.toHaveBeenCalled()
  expect(review.chunkReviewCount).toBe(0)
})

test('reviewPullRequest still reviews every chunk when concurrency is below one', async () => {
  const chat = answering('{"findings": []}')

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    concurrency: 0,
  })

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(review.failures).toEqual([])
})

test('mapWithConcurrency starts no more items after one fails', async () => {
  const started: number[] = []

  const mapping = mapWithConcurrency({
    items: [1, 2, 3, 4],
    limit: 2,
    run: async (item: number) => {
      started.push(item)
      if (item === 1) {
        throw new Error('item 1 failed')
      }
      return item
    },
  })

  await expect(mapping).rejects.toThrow('item 1 failed')
  // Lets the other worker finish its item and look for the next one.
  await new Promise((resolve) => setTimeout(resolve))
  expect(started).toEqual([1, 2])
})

function createSnapshot(contents: Record<string, string>): RepositorySnapshot {
  const entries = new Map<string, RepositoryEntry>([['', {type: 'tree', sha: 'root'}]])
  for (const [path, text] of Object.entries(contents)) {
    entries.set(path, {type: 'blob', sha: `${path}@${text}`})
  }
  return {
    entries,
    readBlob: async (sha) => new TextEncoder().encode(sha.slice(sha.indexOf('@') + 1)),
  }
}

test('reviewPullRequest gives reviewers tools and re-reviews a chunk when a file it read changes', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({
      content: '',
      toolCalls: [{id: '1', name: 'read_file', arguments: '{"path": "helper.ts"}'}],
      usage,
    })
    .mockResolvedValue({content: '{"findings": []}', toolCalls: [], usage})
  const options = {
    files: files(5),
    model: 'vendor/model',
    scope: 'test',
    store,
    chat,
    reviewers: REVIEWERS.slice(0, 1),
  }

  const first = await reviewPullRequest({
    ...options,
    headSnapshot: createSnapshot({'a.ts': 'a', 'helper.ts': 'v1'}),
  })

  expect(first.usage.costUsd).toBeCloseTo(0.02)
  const [request] = chat.mock.calls[0]
  expect(request.tools?.map((tool) => tool.name)).toEqual([
    'read_file',
    'list_directory',
    'read_definition',
  ])
  expect(request.messages[0].content).toContain('the tools read files of the repository')
  expect(chat.mock.calls[1][0].messages.at(-1)).toEqual({
    role: 'tool',
    toolCallId: '1',
    content: 'helper.ts, lines 1-1 of 1:\nL1: v1',
  })

  chat.mockClear()
  const unchanged = await reviewPullRequest({
    ...options,
    headSnapshot: createSnapshot({'a.ts': 'a2', 'helper.ts': 'v1'}),
  })
  expect(chat).not.toHaveBeenCalled()
  expect(unchanged.cachedCount).toBe(1)

  const changed = await reviewPullRequest({
    ...options,
    headSnapshot: createSnapshot({'a.ts': 'a', 'helper.ts': 'v2'}),
  })
  expect(chat).toHaveBeenCalledTimes(1)
  expect(changed.cachedCount).toBe(0)
})

test('reviewPullRequest keeps the billed usage of a chunk review that fails after a tool call', async () => {
  const chat = vi
    .fn<Chat>()
    .mockResolvedValueOnce({
      content: '',
      toolCalls: [{id: '1', name: 'read_file', arguments: '{"path": "helper.ts"}'}],
      usage,
    })
    .mockRejectedValueOnce(new Error('OpenRouter returned 400'))
    .mockResolvedValue({content: '{"findings": []}', toolCalls: [], usage})
  const options = {
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 1),
    headSnapshot: createSnapshot({'a.ts': 'a', 'helper.ts': 'v1'}),
  }

  const review = await reviewPullRequest(options)

  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: 'security', error: 'Error: OpenRouter returned 400'},
  ])
  expect(review.usage).toEqual(usage)
  chat.mockClear()
  await reviewPullRequest(options)
  expect(chat).toHaveBeenCalledTimes(1)
})

test('reviewPullRequest reports a chunk review that throws and runs the other chunk reviews', async () => {
  const chat = vi
    .fn<Chat>()
    .mockImplementationOnce(() => {
      throw new Error('Chat failed before its request')
    })
    .mockResolvedValue({content: '{"findings": []}', toolCalls: [], usage})

  const review = await reviewPullRequest({
    files: files(5),
    model: 'vendor/model',
    store: createMemoryChunkReviewStore(),
    chat,
    scope: 'test',
    reviewers: REVIEWERS.slice(0, 2),
    concurrency: 1,
  })

  expect(review.failures).toEqual([
    {path: 'a.ts', reviewerId: REVIEWERS[0].id, error: 'Error: Chat failed before its request'},
  ])
  expect(chat).toHaveBeenCalledTimes(2)
  expect(review.usage).toEqual(usage)
})

test('reviewPullRequest keys saved results by scope', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering('{"findings": []}')
  const options = {files: files(5), model: 'vendor/model', store, chat, reviewers: REVIEWERS}

  await reviewPullRequest({...options, scope: 'installation:1'})
  await reviewPullRequest({...options, scope: 'installation:2'})

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length * 2)
})

// The tool loop catches a chat that rejects. A chat that throws before it
// returns a promise escapes the loop, and reviewChunks catches the error.
test.each(
  [
    {name: 'a network error', error: new TypeError('connection reset'), retryable: true},
    {
      name: 'a temporary OpenRouter error',
      error: new OpenRouterError('OpenRouter returned 503: busy', true),
      retryable: true,
    },
    {
      name: 'an OpenRouter error that is not temporary',
      error: new OpenRouterError('OpenRouter returned 401: bad key', false),
      retryable: false,
    },
  ].flatMap((row) => [
    {...row, how: 'rejects'},
    {...row, how: 'throws'},
  ]),
)(
  'reviewChunks reports whether a retry can fix $name when the chat $how',
  async ({error, retryable, how}) => {
    const chat = vi.fn<Chat>(
      how === 'throws'
        ? () => {
            throw error
          }
        : () => Promise.reject(error),
    )

    const [outcome] = await reviewChunks({
      units: planChunkReviews({files: files(5), reviewers: REVIEWERS.slice(0, 1)}),
      model: 'vendor/model',
      scope: 'test',
      store: createMemoryChunkReviewStore(),
      chat,
      fileList: '',
    })

    expect(outcome).toMatchObject({findings: [], error: String(error), retryable})
  },
)

test('summarizeChunkReviews throws when the outcomes do not match the units', () => {
  const units = planChunkReviews({files: files(5), reviewers: REVIEWERS.slice(0, 2)})

  expect(() => summarizeChunkReviews({units, outcomes: []})).toThrow(
    'Expected 2 chunk review outcomes, got 0',
  )
})
