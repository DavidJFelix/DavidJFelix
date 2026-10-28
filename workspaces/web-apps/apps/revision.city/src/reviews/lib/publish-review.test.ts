// cSpell:ignore revisioncity -- the GitHub App's slug
import {expect, test} from 'vitest'
import {z} from 'zod'
import type {Finding} from './findings'
import {GitHubApiError, type GitHubRequest} from './github-api'
import {completeCheckRun, createCheckRun, postReview, removeLabel} from './publish-review'
import {fingerprintFinding} from './review-markdown'

const repository = {owner: 'acme', name: 'repo'}

interface RecordedRequest {
  method: string
  path: string
  body?: unknown
}

function fakeGitHub(respond: (call: RecordedRequest) => unknown = () => ({})) {
  const calls: RecordedRequest[] = []
  const request: GitHubRequest = async ({method = 'GET', path, body, schema}) => {
    const call = {method, path, ...(body === undefined ? {} : {body})}
    calls.push(call)
    return schema.parse(await respond(call))
  }
  return {request, calls}
}

const finding = (changes: Partial<Finding> = {}): Finding => ({
  reviewerId: 'security',
  path: 'src/a.ts',
  severity: 'high',
  title: 'Token leaks',
  body: 'The token reaches the log.',
  checked: true,
  startLine: 4,
  endLine: 4,
  ...changes,
})

test('createCheckRun starts an in-progress check run on the head', async () => {
  const github = fakeGitHub(() => ({id: 31}))

  expect(await createCheckRun({request: github.request, repository, headSha: 'abc'})).toBe(31)
  expect(github.calls).toEqual([
    {
      method: 'POST',
      path: '/repos/acme/repo/check-runs',
      body: {name: 'Revision City', head_sha: 'abc', status: 'in_progress'},
    },
  ])
})

test('completeCheckRun sets the conclusion and the output', async () => {
  const github = fakeGitHub()

  await completeCheckRun({
    request: github.request,
    repository,
    checkRunId: 31,
    conclusion: 'success',
    output: {title: 'No findings', summary: 'Clean'},
  })

  expect(github.calls).toEqual([
    {
      method: 'PATCH',
      path: '/repos/acme/repo/check-runs/31',
      body: {
        status: 'completed',
        conclusion: 'success',
        output: {title: 'No findings', summary: 'Clean'},
        actions: [],
      },
    },
  ])
})

test('completeCheckRun adds the dismiss button to a failed check run', async () => {
  const github = fakeGitHub()

  await completeCheckRun({
    request: github.request,
    repository,
    checkRunId: 31,
    conclusion: 'failure',
    output: {title: '1 finding', summary: 'Cost'},
    externalId: 'resolvable-findings',
  })

  expect(github.calls[0].body).toMatchObject({
    actions: [{label: 'Dismiss findings', identifier: 'dismiss'}],
    external_id: 'resolvable-findings',
  })
})

test('removeLabel removes the label from the pull request', async () => {
  const github = fakeGitHub(() => [])

  await removeLabel({request: github.request, repository, pullNumber: 7, label: 'Revision City'})

  expect(github.calls).toEqual([
    {method: 'DELETE', path: '/repos/acme/repo/issues/7/labels/Revision%20City'},
  ])
})

const COMMENTS_PATH = '/repos/acme/repo/pulls/7/comments?per_page=100&page=1'
const REVIEWS_PATH = '/repos/acme/repo/pulls/7/reviews'

test('postReview posts each new finding as an inline comment on the head', async () => {
  const github = fakeGitHub(({path}) => (path === COMMENTS_PATH ? [] : {id: 1}))
  const single = finding()
  const range = finding({reviewerId: 'correctness', startLine: 8, endLine: 10, title: 'Off by one'})

  const posted = await postReview({
    request: github.request,
    repository,
    pullNumber: 7,
    headSha: 'abc',
    findings: [single, range],
  })

  expect(posted).toEqual({count: 2, inline: true})
  const [, review] = github.calls
  expect(review).toMatchObject({
    method: 'POST',
    path: REVIEWS_PATH,
    body: {
      commit_id: 'abc',
      event: 'COMMENT',
      body: 'Revision City posted 2 new findings. The Revision City check lists every finding.',
      comments: [
        {path: 'src/a.ts', side: 'RIGHT', line: 4},
        {path: 'src/a.ts', side: 'RIGHT', line: 10, start_line: 8, start_side: 'RIGHT'},
      ],
    },
  })
  const [comment] = sentComments(review.body)
  expect(
    comment.body.startsWith(`<!-- revision-city:${await fingerprintFinding(single)} -->`),
  ).toBe(true)
})

const marker = async (item: Finding) => `<!-- revision-city:${await fingerprintFinding(item)} -->`

const sentComments = (body: unknown) =>
  z.object({comments: z.array(z.object({body: z.string()}))}).parse(body).comments

test('postReview skips findings that the app already posted on the same line', async () => {
  const posted = finding()
  const moved = finding({title: 'Moved', startLine: 6, endLine: 6})
  const existing = [
    {body: await marker(posted), path: 'src/a.ts', line: 4, user: {login: 'revisioncity[bot]'}},
    // The same finding from someone else, or on an outdated line, does not count.
    {body: await marker(moved), path: 'src/a.ts', line: 6, user: {login: 'someone'}},
    {body: await marker(moved), path: 'src/a.ts', line: null, user: {login: 'revisioncity[bot]'}},
    {body: 'A reply', path: 'src/a.ts', line: 6, user: null},
  ]
  const github = fakeGitHub(({path}) => (path === COMMENTS_PATH ? existing : {id: 1}))

  const count = await postReview({
    request: github.request,
    repository,
    pullNumber: 7,
    headSha: 'abc',
    findings: [posted, moved],
  })

  expect(count).toEqual({count: 1, inline: true})
  expect(github.calls[1].body).toMatchObject({comments: [{line: 6}]})
})

test('postReview posts nothing when every finding is already posted', async () => {
  const posted = finding()
  const existing = [
    {body: await marker(posted), path: 'src/a.ts', line: 4, user: {login: 'revisioncity[bot]'}},
  ]
  const github = fakeGitHub(() => existing)

  expect(
    await postReview({
      request: github.request,
      repository,
      pullNumber: 7,
      headSha: 'abc',
      findings: [posted],
    }),
  ).toEqual({count: 0, inline: true})
  expect(github.calls.map(({path}) => path)).toEqual([COMMENTS_PATH])
})

test('postReview posts the 50 most severe findings in one review', async () => {
  const github = fakeGitHub(({path}) => (path === COMMENTS_PATH ? [] : {id: 1}))
  const findings = [
    ...Array.from({length: 60}, (_, index) =>
      finding({severity: 'medium', startLine: index + 1, endLine: index + 1}),
    ),
    finding({severity: 'critical', startLine: 99, endLine: 99}),
  ]

  expect(
    await postReview({
      request: github.request,
      repository,
      pullNumber: 7,
      headSha: 'abc',
      findings,
    }),
  ).toEqual({count: 50, inline: true})
  const {comments} = z
    .object({comments: z.array(z.object({line: z.number()}))})
    .parse(github.calls[1].body)
  expect(comments).toHaveLength(50)
  expect(comments[0].line).toBe(99)
})

test('postReview lists the findings in the review body when GitHub refuses the comments', async () => {
  const github = fakeGitHub(({path, body}) => {
    if (path === COMMENTS_PATH) {
      return []
    }
    if (typeof body === 'object' && body !== null && 'comments' in body) {
      throw new GitHubApiError(422, 'Line could not be resolved')
    }
    return {id: 2}
  })

  const count = await postReview({
    request: github.request,
    repository,
    pullNumber: 7,
    headSha: 'abc',
    findings: [finding()],
  })

  expect(count).toEqual({count: 1, inline: false})
  expect(github.calls[2]).toEqual({
    method: 'POST',
    path: REVIEWS_PATH,
    body: {
      commit_id: 'abc',
      event: 'COMMENT',
      body: [
        'Revision City posted 1 new finding. GitHub did not accept inline comments on these lines:',
        '',
        '- **high** `src/a.ts:4` (security): Token leaks',
      ].join('\n'),
    },
  })
})

test('postReview throws other GitHub failures', async () => {
  const github = fakeGitHub(({path}) => {
    if (path === COMMENTS_PATH) {
      return []
    }
    throw new GitHubApiError(500, 'Server error')
  })

  await expect(
    postReview({
      request: github.request,
      repository,
      pullNumber: 7,
      headSha: 'abc',
      findings: [finding()],
    }),
  ).rejects.toThrow('Server error')
})
