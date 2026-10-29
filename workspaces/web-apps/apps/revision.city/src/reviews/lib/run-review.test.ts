// cSpell:ignore revisioncity -- the GitHub App's slug
import {serialize} from 'node:v8'
import {expect, test, vi} from 'vitest'
import {z} from 'zod'
import {createMemoryChunkReviewStore} from './chunk-review-store'
import {GitHubApiError, type GitHubRequest} from './github-api'
import {type Chat, OpenRouterError} from './openrouter'
import {REVIEWERS} from './reviewers'
import {type RunReviewParams, type RunStep, runReview} from './run-review'

const headSha = 'a'.repeat(40)
const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

interface RecordedRequest {
  method: string
  path: string
  body?: unknown
}

type Route = (call: RecordedRequest) => unknown

const PULL = 'GET /repos/acme/repo/pulls/7'
const FILES = 'GET /repos/acme/repo/pulls/7/files?per_page=100&page=1'
const FILES_PAGE_2 = 'GET /repos/acme/repo/pulls/7/files?per_page=100&page=2'
const CHECK_RUNS = 'POST /repos/acme/repo/check-runs'
const CHECK_RUN = 'PATCH /repos/acme/repo/check-runs/31'
const TREE = `GET /repos/acme/repo/git/trees/${headSha}?recursive=1`
const COMMENTS = 'GET /repos/acme/repo/pulls/7/comments?per_page=100&page=1'
const REVIEWS = 'POST /repos/acme/repo/pulls/7/reviews'
const LABEL = 'DELETE /repos/acme/repo/issues/7/labels/Revision%20City'
const GRAPHQL = 'POST /graphql'
const checkRunList = (sha: string) =>
  `GET /repos/acme/repo/commits/${sha}/check-runs?check_name=Revision%20City&filter=latest`
const PERMISSION = 'GET /repos/acme/repo/collaborators/maintainer/permission'

const movedSha = 'b'.repeat(40)
const openPull = {state: 'open', head: {sha: headSha}}
const movedPull = {state: 'open', head: {sha: movedSha}}

const changedFile = (filename: string, patch?: string) => ({filename, status: 'modified', patch})

const SMALL_PATCH = '@@ -1,1 +1,2 @@\n ctx\n+added'

const threadsAnswer = (...threads: {isResolved: boolean}[]) => ({
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: {hasNextPage: false, endCursor: null},
          nodes: threads.map(({isResolved}) => ({
            isResolved,
            isOutdated: false,
            resolvedBy: isResolved ? {login: 'maintainer'} : null,
            comments: {nodes: [{author: {login: 'revisioncity'}}]},
          })),
        },
      },
    },
  },
})

// Answers each request from its route, and records it. The check run list
// shows the last update of check run 31, and the app has one open thread.
function fakeGitHub(routes: Record<string, Route> = {}) {
  const calls: RecordedRequest[] = []
  const lastCheckRun = () =>
    z
      .object({
        conclusion: z.string(),
        external_id: z.string().optional(),
        output: z.object({title: z.string(), summary: z.string()}),
      })
      .parse(calls.findLast(({method, path}) => `${method} ${path}` === CHECK_RUN)?.body)
  const listedCheckRun = () => {
    const {conclusion, external_id: externalId, output} = lastCheckRun()
    return {
      check_runs: [
        {
          id: 31,
          status: 'completed',
          conclusion,
          external_id: externalId ?? null,
          app: {slug: 'revisioncity'},
          output: {...output, text: null},
        },
      ],
    }
  }
  const allRoutes: Record<string, Route> = {
    ...Object.fromEntries([headSha, movedSha].map((sha) => [checkRunList(sha), listedCheckRun])),
    [GRAPHQL]: () => threadsAnswer({isResolved: false}),
    [PERMISSION]: () => ({permission: 'admin'}),
    [PULL]: () => openPull,
    [FILES]: () => [changedFile('src/a.ts', SMALL_PATCH)],
    [CHECK_RUNS]: () => ({id: 31}),
    [CHECK_RUN]: () => ({}),
    'GET /repos/acme/repo/check-runs/31': () => ({
      external_id: lastCheckRun().external_id ?? null,
    }),
    [TREE]: () => ({sha: 'tree', truncated: false, tree: []}),
    [COMMENTS]: () => [],
    [REVIEWS]: () => ({id: 1}),
    [LABEL]: () => [],
    ...routes,
  }
  const request: GitHubRequest = async ({method = 'GET', path, body, schema}) => {
    const call = {method, path, ...(body === undefined ? {} : {body})}
    calls.push(call)
    const route = allRoutes[`${method} ${path}`]
    if (route === undefined) {
      throw new Error(`Unexpected request: ${method} ${path}`)
    }
    return schema.parse(await route(call))
  }
  const sent = (route: string) => calls.filter(({method, path}) => `${method} ${path}` === route)
  return {request, sent}
}

// The pull request as GitHub shows it on each read: the last answer repeats.
const pullReads = (...answers: object[]) => {
  let reads = 0
  return () => answers[Math.min(reads++, answers.length - 1)]
}

const COST_LINES = [
  '',
  '### Cost per chunk review',
  '',
  ...REVIEWERS.map(
    (reviewer) => `- $0.0100 \`src/a.ts\` (${reviewer.id}): 10 prompt tokens, 5 completion tokens`,
  ),
]

const answering = (findings: object[]) =>
  vi.fn<Chat>(async () => ({content: JSON.stringify({findings}), toolCalls: [], usage}))

const highFinding = {severity: 'high', title: 'Bug', body: 'Breaks', checked: true, label: 2}

function recordingStep() {
  const names: string[] = []
  const results = new Map<string, unknown>()
  const step: RunStep = async (name, run) => {
    names.push(name)
    const result = await run({isLastAttempt: true})
    results.set(name, result)
    return result
  }
  return {step, names, results}
}

// Runs a failed step again, as the Workflow does, but only once.
const retryingStep: RunStep = async (_name, run) =>
  run({isLastAttempt: false}).catch(() => run({isLastAttempt: true}))

const checkRunText = (body: unknown) =>
  z.object({output: z.object({text: z.string()})}).parse(body).output.text

function runParams(changes: Partial<RunReviewParams> = {}): RunReviewParams {
  return {
    installationId: 5,
    repositoryId: 9,
    owner: 'acme',
    name: 'repo',
    pullNumber: 7,
    headSha,
    step: recordingStep().step,
    request: fakeGitHub().request,
    chat: answering([]),
    store: createMemoryChunkReviewStore(),
    model: 'vendor/model',
    ...changes,
  }
}

test('runReview reviews the head, posts the findings, and fails the check on a high finding', async () => {
  const github = fakeGitHub()
  const {step, names} = recordingStep()
  const chat = answering([highFinding])

  await runReview(runParams({step, request: github.request, chat}))

  expect(names).toEqual([
    'start',
    'select files',
    'review 1 of 1',
    'post review',
    'complete check run',
  ])
  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(github.sent(CHECK_RUNS)).toHaveLength(1)
  // Every reviewer flagged the same line, so one comment is posted.
  expect(github.sent(REVIEWS)[0].body).toMatchObject({
    commit_id: headSha,
    comments: [{path: 'src/a.ts', line: 2}],
  })
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    status: 'completed',
    conclusion: 'failure',
    output: {title: '1 finding'},
  })
})

// The comments of a first run, as GitHub lists them on the next run.
async function postedComments() {
  const github = fakeGitHub()
  await runReview(runParams({request: github.request, chat: answering([highFinding])}))
  return z
    .object({comments: z.array(z.object({body: z.string(), path: z.string(), line: z.number()}))})
    .parse(github.sent(REVIEWS)[0].body)
    .comments.map(({body, path, line}) => ({body, path, line, user: {login: 'revisioncity[bot]'}}))
}

test.each([
  {
    name: 'passes when its thread is resolved',
    isResolved: true,
    conclusion: 'success',
    title: 'Resolved: 1 finding',
  },
  {
    name: 'fails when its thread is open',
    isResolved: false,
    conclusion: 'failure',
    title: '1 finding',
  },
])(
  'runReview with a high finding that an earlier run posted $name',
  async ({isResolved, conclusion, title}) => {
    const comments = await postedComments()
    const github = fakeGitHub({
      [COMMENTS]: () => comments,
      [GRAPHQL]: () => threadsAnswer({isResolved}),
    })

    await runReview(runParams({request: github.request, chat: answering([highFinding])}))

    expect(github.sent(REVIEWS)).toEqual([])
    expect(github.sent(CHECK_RUN).at(-1)?.body).toMatchObject({
      conclusion,
      output: {title},
      external_id: 'resolvable-findings',
    })
  },
)

test('runReview keeps the failed check run when the sync with the threads fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const github = fakeGitHub({
    [GRAPHQL]: () => {
      throw new Error('GitHub is down')
    },
  })
  const {step, names} = recordingStep()

  await runReview(runParams({step, request: github.request, chat: answering([highFinding])}))

  expect(names.at(-1)).toBe('complete check run')
  expect(github.sent(CHECK_RUN)).toHaveLength(1)
  expect(warn).toHaveBeenCalledWith('Could not sync the check run with the threads', {
    error: 'Error: GitHub is down',
  })
  warn.mockRestore()
})

test('runReview keeps the check red when GitHub refuses the inline comments', async () => {
  let reviews = 0
  const github = fakeGitHub({
    [REVIEWS]: () => {
      reviews += 1
      if (reviews === 1) {
        throw new GitHubApiError(422, 'Unprocessable')
      }
      return {id: 1}
    },
  })

  await runReview(runParams({request: github.request, chat: answering([highFinding])}))

  expect(github.sent(CHECK_RUN)).toHaveLength(1)
  expect(github.sent(CHECK_RUN)[0].body).not.toHaveProperty('external_id')
  expect(github.sent(GRAPHQL)).toEqual([])
})

test('runReview passes the check and posts nothing when there are no findings', async () => {
  const github = fakeGitHub()

  await runReview(runParams({request: github.request}))

  expect(github.sent(REVIEWS)).toEqual([])
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'success',
    output: {title: 'No findings'},
  })
})

test('runReview does not post a finding that the reviewer did not check', async () => {
  const github = fakeGitHub()
  const chat = answering([{...highFinding, checked: false}])

  await runReview(runParams({request: github.request, chat}))

  expect(github.sent(REVIEWS)).toEqual([])
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'success',
    output: {title: '1 unchecked finding'},
  })
  // Every reviewer flagged the same line, so the check run lists it once.
  expect(checkRunText(github.sent(CHECK_RUN)[0].body)).toBe(
    [
      '### Not checked, so not posted',
      '',
      '- **high** `src/a.ts:2` (security): Bug',
      ...COST_LINES,
    ].join('\n'),
  )
})

test('runReview reuses saved chunk reviews in the same installation', async () => {
  const store = createMemoryChunkReviewStore()
  const chat = answering([highFinding])
  await runReview(runParams({store, chat}))
  chat.mockClear()

  await runReview(runParams({store, chat}))
  expect(chat).not.toHaveBeenCalled()

  await runReview(runParams({store, chat, installationId: 6}))
  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
})

test('runReview reviews the current head when a label asked for the review', async () => {
  const github = fakeGitHub({
    [PULL]: () => movedPull,
    [`GET /repos/acme/repo/git/trees/${movedSha}?recursive=1`]: () => ({
      sha: 'tree',
      truncated: false,
      tree: [],
    }),
  })

  await runReview(
    runParams({request: github.request, label: 'Revision City', chat: answering([highFinding])}),
  )

  expect(github.sent(CHECK_RUNS)[0].body).toMatchObject({head_sha: movedSha})
  expect(github.sent(REVIEWS)[0].body).toMatchObject({commit_id: movedSha})
})

test('runReview removes the label that asked for the review, and continues when that fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const github = fakeGitHub({
    [LABEL]: () => {
      throw new Error('label not found')
    },
  })

  await runReview(runParams({request: github.request, label: 'Revision City'}))

  expect(github.sent(LABEL)).toHaveLength(1)
  expect(warn).toHaveBeenCalledWith('Could not remove the review label', {
    error: 'Error: label not found',
  })
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({conclusion: 'success'})
  warn.mockRestore()
})

test.each([
  {name: 'closed', pull: {...openPull, state: 'closed'}},
  {name: 'on another head', pull: movedPull},
])('runReview stops before the check run when the pull request is $name', async ({pull}) => {
  const github = fakeGitHub({[PULL]: () => pull})
  const {step, names} = recordingStep()

  await runReview(runParams({step, request: github.request}))

  expect(names).toEqual(['start'])
  expect(github.sent(CHECK_RUNS)).toEqual([])
})

test('runReview stops reviewing and marks the check neutral when the head moves', async () => {
  const github = fakeGitHub({[PULL]: pullReads(openPull, movedPull)})
  const chat = answering([highFinding])

  await runReview(runParams({request: github.request, chat}))

  expect(chat).not.toHaveBeenCalled()
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'neutral',
    output: {title: 'The pull request changed during the review'},
  })
})

test('runReview posts nothing when the head moves before the review is posted', async () => {
  const github = fakeGitHub({[PULL]: pullReads(openPull, openPull, movedPull)})

  await runReview(runParams({request: github.request, chat: answering([highFinding])}))

  expect(github.sent(REVIEWS)).toEqual([])
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({conclusion: 'neutral'})
})

test('runReview fails the check run and throws when a step after the start fails', async () => {
  const github = fakeGitHub({
    [FILES]: () => {
      throw new Error('GitHub is down for @someone')
    },
  })
  const {step, names} = recordingStep()

  await expect(runReview(runParams({step, request: github.request}))).rejects.toThrow(
    'GitHub is down',
  )

  expect(names).toEqual(['start', 'select files', 'report failure'])
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'failure',
    output: {title: 'The review failed', summary: 'Error: GitHub is down for @​someone'},
  })
})

test('runReview tries a review step again when a model call fails for a temporary reason', async () => {
  const github = fakeGitHub()
  const chat = answering([])
  chat.mockRejectedValueOnce(new OpenRouterError('OpenRouter returned 503: busy', true))

  await runReview(runParams({step: retryingStep, request: github.request, chat}))

  // The second attempt reads the saved answers and asks again only for the
  // review that failed.
  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length + 1)
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({conclusion: 'success'})
})

test('runReview does not try a review step again when OpenRouter refuses a request', async () => {
  const github = fakeGitHub()
  const chat = answering([])
  chat.mockRejectedValueOnce(new OpenRouterError('OpenRouter returned 402: no credits', false))

  await runReview(runParams({step: retryingStep, request: github.request, chat}))

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'failure',
    output: {title: '1 failed chunk review'},
  })
})

test('runReview reports a chunk review whose model call fails on the last attempt', async () => {
  const github = fakeGitHub()
  const chat = answering([])
  chat.mockRejectedValueOnce(new OpenRouterError('OpenRouter returned 503: busy', true))

  await runReview(runParams({request: github.request, chat}))

  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'failure',
    output: {title: '1 failed chunk review'},
  })
})

test('runReview lists the files that it left out, but not the files that it skips', async () => {
  const longPatch = ['@@ -1,1 +1,1600 @@', ...Array.from({length: 1600}, () => '+x')].join('\n')
  const widePatch = [
    '@@ -1,1 +1,1400 @@',
    ...Array.from({length: 1400}, () => `+${'x'.repeat(600)}`),
  ].join('\n')
  const github = fakeGitHub({
    [FILES]: () => [
      changedFile('image.png'),
      changedFile('generated.ts', longPatch),
      changedFile('src/a.ts', SMALL_PATCH),
      changedFile('wide.ts', widePatch),
      changedFile('bun.lock', SMALL_PATCH),
    ],
  })
  const chat = answering([])

  await runReview(runParams({request: github.request, chat}))

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(checkRunText(github.sent(CHECK_RUN)[0].body)).toBe(
    [
      '### Not reviewed',
      '',
      '- `image.png`: GitHub shows no text diff',
      '- `generated.ts`: the diff is longer than 1500 lines',
      '- `wide.ts`: over the review size limit',
      ...COST_LINES,
    ].join('\n'),
  )
})

test('runReview gives each reviewer the list of every file that the pull request changes', async () => {
  const github = fakeGitHub({
    [FILES]: () => [
      changedFile('src/a.ts', SMALL_PATCH),
      changedFile('image.png'),
      changedFile('bun.lock', SMALL_PATCH),
    ],
  })
  const chat = answering([])

  await runReview(runParams({request: github.request, chat}))

  expect(chat).toHaveBeenCalledTimes(REVIEWERS.length)
  expect(chat.mock.calls[0][0].messages[1]).toEqual({
    role: 'user',
    content: [
      'Files that the pull request changes:',
      '- src/a.ts (modified)',
      '- image.png (modified)',
      '- bun.lock (modified)',
      '',
      'File: src/a.ts',
      '',
      '    1   ctx',
      '    2 + added',
    ].join('\n'),
  })
})

test('runReview reviews at most 150 chunks, in steps, and loads the head tree once', async () => {
  const files = Array.from({length: 151}, (_, index) => changedFile(`src/${index}.ts`, SMALL_PATCH))
  const github = fakeGitHub({
    [FILES]: () => files.slice(0, 100),
    [FILES_PAGE_2]: () => files.slice(100),
  })
  const {step, names} = recordingStep()
  const chat = answering([])

  await runReview(runParams({step, request: github.request, chat}))

  expect(chat).toHaveBeenCalledTimes(150 * REVIEWERS.length)
  expect(names.filter((name) => name.startsWith('review '))).toHaveLength(150)
  expect(names).toContain('review 150 of 150')
  expect(github.sent(TREE)).toHaveLength(1)
  expect(checkRunText(github.sent(CHECK_RUN)[0].body)).toContain(
    '- `src/150.ts`: over the review size limit',
  )
})

test('runReview keeps each step result under 1 MiB when each answer is at the finding limits', async () => {
  // One character above U+00FF makes V8 store the whole string with 2 bytes for
  // each character. The title, the body, and the count of findings are over their
  // limits, and the suggestion is at its limit.
  const text = (length: number) => '\u0101'.repeat(length)
  const finding = {
    severity: 'critical',
    title: text(300),
    body: text(4000),
    label: 2,
    suggestion: text(3000),
  }
  const github = fakeGitHub({
    [FILES]: () => [changedFile('src/a.ts', SMALL_PATCH), changedFile('src/b.ts', SMALL_PATCH)],
  })
  const {step, results} = recordingStep()
  const chat = answering(Array.from({length: 25}, () => finding))

  await runReview(runParams({step, request: github.request, chat}))

  const sizes = [...results.values()].map((result) => serialize(result).byteLength)
  expect(Math.max(...sizes)).toBeLessThan(2 ** 20)
})

test('runReview loads the head tree again after a failed load', async () => {
  let treeReads = 0
  const github = fakeGitHub({
    [TREE]: () => {
      treeReads += 1
      if (treeReads === 1) {
        throw new Error('tree unavailable')
      }
      return {sha: 'tree', truncated: false, tree: []}
    },
  })
  await runReview(runParams({step: retryingStep, request: github.request}))

  expect(treeReads).toBe(2)
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({conclusion: 'success'})
})
