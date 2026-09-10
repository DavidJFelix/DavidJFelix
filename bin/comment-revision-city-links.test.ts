import {expect, test} from 'bun:test'
import type {GhClient, GhResponse} from './comment-revision-city-links'
import {
  buildCommentBody,
  commitTitle,
  escapeLinkText,
  resolveChangedCommits,
} from './comment-revision-city-links'

const repo = 'DavidJFelix/DavidJFelix'
const sha = (seed: string): string => seed.repeat(40).slice(0, 40)

test('the body links the PR first, then every commit, in the revision.city format', () => {
  const body = buildCommentBody({
    repo,
    prNumber: '583',
    prTitle: 'PR Title here',
    commits: [
      {sha: '2e4ccc96a5ec89585f2c7d8789dfe371177c6729', title: 'commit title here'},
      {sha: 'a7fbec5b1d9e0c3f4a6b8d7e9f0a1b2c3d4e5f6a', title: 'second commit'},
    ],
  })

  expect(body).toBe(
    'See this change in revision.city:\n' +
      '\n' +
      '- [PR #583 - PR Title here](https://revision.city/diffs/DavidJFelix/DavidJFelix/pull/583)\n' +
      '- [Commit 2e4ccc9 - commit title here](https://revision.city/diffs/DavidJFelix/DavidJFelix/commit/2e4ccc96a5ec89585f2c7d8789dfe371177c6729)\n' +
      '- [Commit a7fbec5 - second commit](https://revision.city/diffs/DavidJFelix/DavidJFelix/commit/a7fbec5b1d9e0c3f4a6b8d7e9f0a1b2c3d4e5f6a)',
  )
})

test('a push that introduced no PR commits still links the PR', () => {
  const body = buildCommentBody({repo, prNumber: '9', prTitle: 'Rollback', commits: []})

  expect(body).toBe(
    'See this change in revision.city:\n' +
      '\n' +
      '- [PR #9 - Rollback](https://revision.city/diffs/DavidJFelix/DavidJFelix/pull/9)',
  )
})

test.each([
  ['brackets', 'fix [WIP] the thing', 'fix \\[WIP\\] the thing'],
  ['emphasis', 'bump foo_bar to *v2*', 'bump foo\\_bar to \\*v2\\*'],
  ['code spans', 'chore: pin `bun`', 'chore: pin \\`bun\\`'],
  ['raw html', 'feat: <details> block', 'feat: \\<details\\> block'],
  ['strikethrough', 'drop ~~old~~ path', 'drop \\~\\~old\\~\\~ path'],
  ['backslash', 'escape a\\b', 'escape a\\\\b'],
  ['plain title untouched', 'feat(djf.io): add dark mode #12', 'feat(djf.io): add dark mode #12'],
])('escapeLinkText neutralizes %s', (_case, input, expected) => {
  expect(escapeLinkText(input)).toBe(expected)
})

test.each([
  ['the first line only', 'feat: x\n\nA body paragraph.', 'feat: x'],
  ['surrounding whitespace trimmed', '  feat: x  \n', 'feat: x'],
  ['CRLF endings', 'feat: x\r\nbody', 'feat: x'],
  ['a single line', 'feat: x', 'feat: x'],
])('commitTitle keeps %s', (_case, message, expected) => {
  expect(commitTitle(message)).toBe(expected)
})

// A GitHub client backed by per-path page handlers; records every path it was
// asked for so a test can assert which endpoints ran.
interface FakeGh {
  readonly gh: GhClient
  readonly calls: string[]
}

type Pages = Record<string, (page: number) => GhResponse>

function fakeGh(pages: Pages): FakeGh {
  const calls: string[] = []
  const gh: GhClient = async (method, path) => {
    calls.push(`${method} ${path}`)
    const [route, query] = path.split('?')
    const page = Number(new URLSearchParams(query).get('page') ?? '1')
    const handler = pages[route ?? '']
    if (!handler) return {status: 404, body: 'Not Found'}
    return handler(page)
  }
  return {gh, calls}
}

const apiCommit = (seed: string, message: string) => ({sha: sha(seed), commit: {message}})
const pullsPath = `/repos/${repo}/pulls/583/commits`
const comparePath = (before: string, after: string) => `/repos/${repo}/compare/${before}...${after}`

test('opened lists every commit in the PR and never calls the compare endpoint', async () => {
  const {gh, calls} = fakeGh({
    [pullsPath]: () => ({
      status: 200,
      body: [apiCommit('a', 'feat: first\n\nbody'), apiCommit('b', 'fix: second')],
    }),
  })

  const commits = await resolveChangedCommits({
    gh,
    repo,
    prNumber: '583',
    action: 'opened',
    before: undefined,
    after: undefined,
  })

  expect(commits).toEqual([
    {sha: sha('a'), title: 'feat: first'},
    {sha: sha('b'), title: 'fix: second'},
  ])
  expect(calls.some((call) => call.includes('/compare/'))).toBe(false)
})

test('synchronize lists only the commits the push added, in PR order', async () => {
  const {gh} = fakeGh({
    [pullsPath]: () => ({
      status: 200,
      body: [
        apiCommit('a', 'old'),
        apiCommit('b', 'older'),
        apiCommit('c', 'new'),
        apiCommit('d', 'newer'),
      ],
    }),
    [comparePath(sha('b'), sha('d'))]: () => ({
      status: 200,
      body: {commits: [apiCommit('c', 'new'), apiCommit('d', 'newer')]},
    }),
  })

  const commits = await resolveChangedCommits({
    gh,
    repo,
    prNumber: '583',
    action: 'synchronize',
    before: sha('b'),
    after: sha('d'),
  })

  expect(commits.map(({title}) => title)).toEqual(['new', 'newer'])
})

test('synchronize after merging main keeps the merge commit and drops main history', async () => {
  const {gh} = fakeGh({
    [pullsPath]: () => ({
      status: 200,
      body: [apiCommit('a', 'branch work'), apiCommit('e', "Merge branch 'main' into feature")],
    }),
    [comparePath(sha('a'), sha('e'))]: () => ({
      status: 200,
      body: {
        commits: [
          apiCommit('1', 'main commit one'),
          apiCommit('2', 'main commit two'),
          apiCommit('e', "Merge branch 'main' into feature"),
        ],
      },
    }),
  })

  const commits = await resolveChangedCommits({
    gh,
    repo,
    prNumber: '583',
    action: 'synchronize',
    before: sha('a'),
    after: sha('e'),
  })

  expect(commits).toEqual([{sha: sha('e'), title: "Merge branch 'main' into feature"}])
})

test.each([404, 422])(
  'synchronize falls back to every PR commit when the compare answers %i',
  async (status) => {
    const {gh} = fakeGh({
      [pullsPath]: () => ({status: 200, body: [apiCommit('a', 'one'), apiCommit('b', 'two')]}),
      [comparePath(sha('0'), sha('b'))]: () => ({status, body: 'gone'}),
    })

    const commits = await resolveChangedCommits({
      gh,
      repo,
      prNumber: '583',
      action: 'synchronize',
      before: sha('0'),
      after: sha('b'),
    })

    expect(commits.map(({title}) => title)).toEqual(['one', 'two'])
  },
)

test('the PR commit list is walked page by page until a short page', async () => {
  const fullPage = Array.from({length: 100}, (_, i) => apiCommit(String(i % 10), `commit ${i}`))
  const {gh, calls} = fakeGh({
    [pullsPath]: (page) => ({status: 200, body: page === 1 ? fullPage : [apiCommit('f', 'last')]}),
  })

  const commits = await resolveChangedCommits({
    gh,
    repo,
    prNumber: '583',
    action: 'opened',
    before: undefined,
    after: undefined,
  })

  expect(commits).toHaveLength(101)
  expect(commits.at(-1)?.title).toBe('last')
  expect(calls.filter((call) => call.startsWith(`GET ${pullsPath}`))).toHaveLength(2)
})

test('a failing PR commit list is an error, not an empty comment', async () => {
  const {gh} = fakeGh({[pullsPath]: () => ({status: 403, body: 'rate limited'})})

  await expect(
    resolveChangedCommits({
      gh,
      repo,
      prNumber: '583',
      action: 'opened',
      before: undefined,
      after: undefined,
    }),
  ).rejects.toThrow('HTTP 403')
})
