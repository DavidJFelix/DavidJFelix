import {expect, test} from 'vitest'

import {getDiffCardPath, getDiffShareText, parseDiffCardPath} from './diff-share-text'
import type {GitHubDiffSource} from './github-diff-source'
import type {PublicPullRequest} from './github-public-pull-request'

const REPO = {owner: 'acme', repo: 'widgets'}
const PULL: GitHubDiffSource = {kind: 'pull', number: '7', repo: REPO}
const COMMIT: GitHubDiffSource = {
  kind: 'commit',
  repo: REPO,
  sha: '83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
}
const COMPARE: GitHubDiffSource = {kind: 'compare', range: 'v1.0...v2.0', repo: REPO}
const PUBLIC_PULL: PublicPullRequest = {
  title: 'Add widgets',
  author: 'maintainer',
  state: 'open',
  draft: false,
  additions: 12,
  deletions: 3,
  changedFiles: 2,
}

test('a pull request link says its repository and number, and nothing GitHub did not show', () => {
  expect(getDiffShareText({source: PULL})).toEqual({
    title: 'acme/widgets #7',
    description: 'Pull request #7 in acme/widgets, in the revision.city diff viewer.',
    card: {title: 'acme/widgets #7', description: 'Pull request'},
    imagePath: '/og/diffs/acme/widgets/pull/7.png',
    imageAlt: 'Title card for acme/widgets #7',
  })
})

test('a commit link names the commit by its short SHA', () => {
  expect(getDiffShareText({source: COMMIT})).toEqual({
    title: 'acme/widgets @ 83fea5e',
    description: 'Commit 83fea5e in acme/widgets, in the revision.city diff viewer.',
    card: {title: 'acme/widgets @ 83fea5e', description: 'Commit'},
    imagePath: '/og/diffs/acme/widgets/commit/83fea5e63ef8751ddbcfabe33154bc2e096c3d85.png',
    imageAlt: 'Title card for acme/widgets @ 83fea5e',
  })
})

test('a compare link names the range', () => {
  expect(getDiffShareText({source: COMPARE})).toEqual({
    title: 'acme/widgets v1.0...v2.0',
    description: 'Comparing v1.0...v2.0 in acme/widgets, in the revision.city diff viewer.',
    card: {title: 'acme/widgets v1.0...v2.0', description: 'Compare'},
    imagePath: '/og/diffs/acme/widgets/compare/v1.0...v2.0.png',
    imageAlt: 'Title card for acme/widgets v1.0...v2.0',
  })
})

test('a public pull request leads with its title and carries the author and the counts', () => {
  expect(getDiffShareText({source: PULL, pull: PUBLIC_PULL})).toEqual({
    title: 'Add widgets · acme/widgets #7',
    description: 'Pull request #7 by maintainer in acme/widgets: 2 files changed, +12 -3.',
    card: {
      title: 'Add widgets',
      description: 'acme/widgets #7 · 2 files changed, +12 -3',
      author: 'by maintainer',
    },
    imagePath: '/og/diffs/acme/widgets/pull/7.png',
    imageAlt: 'Title card for acme/widgets #7',
  })
})

test.each([
  {name: 'merged', pull: {state: 'merged'}, kind: 'Merged pull request'},
  {name: 'closed', pull: {state: 'closed'}, kind: 'Closed pull request'},
  {name: 'a closed draft', pull: {state: 'closed', draft: true}, kind: 'Closed pull request'},
  {name: 'an open draft', pull: {draft: true}, kind: 'Draft pull request'},
] as const)('describes $name by its state', ({pull, kind}) => {
  const share = getDiffShareText({source: PULL, pull: {...PUBLIC_PULL, ...pull}})

  expect(share.description).toBe(
    `${kind} #7 by maintainer in acme/widgets: 2 files changed, +12 -3.`,
  )
})

test('counts a single changed file in the singular', () => {
  const share = getDiffShareText({source: PULL, pull: {...PUBLIC_PULL, changedFiles: 1}})

  expect(share.description).toBe(
    'Pull request #7 by maintainer in acme/widgets: 1 file changed, +12 -3.',
  )
})

test('groups large counts in thousands', () => {
  const share = getDiffShareText({
    source: PULL,
    pull: {...PUBLIC_PULL, changedFiles: 2188, additions: 1009257, deletions: 4024},
  })

  expect(share.description).toBe(
    'Pull request #7 by maintainer in acme/widgets: 2,188 files changed, +1,009,257 -4,024.',
  )
  expect(share.card.description).toBe('acme/widgets #7 · 2,188 files changed, +1,009,257 -4,024')
})

test('leaves out the byline and the counts when GitHub did not send them', () => {
  const share = getDiffShareText({
    source: PULL,
    pull: {title: 'Add widgets', state: 'open', draft: false},
  })

  expect(share.description).toBe('Pull request #7 in acme/widgets.')
  expect(share.card).toEqual({title: 'Add widgets', description: 'acme/widgets #7'})
})

test('shortens a long title on the card but not in the tags', () => {
  const title =
    'A pull request title that runs on far past ninety characters so the card cannot hold it all'
  const share = getDiffShareText({source: PULL, pull: {...PUBLIC_PULL, title}})

  expect(share.title).toBe(`${title} · acme/widgets #7`)
  expect(share.card.title).toHaveLength(90)
  expect(share.card.title.endsWith('…')).toBe(true)
})

// The card route reads the diff back out of the path the tags point at, so
// the two must agree for every shape of diff, including ranges that carry the
// characters a path would otherwise split on.
test.each([
  {name: 'a pull request', source: PULL},
  {name: 'a commit', source: COMMIT},
  {name: 'a compare range', source: COMPARE},
  {
    name: 'a cross-fork compare range with a branch path',
    source: {kind: 'compare', range: 'acme:main...fork:feature/x', repo: REPO} as const,
  },
])('round-trips the card path for $name', ({source}) => {
  expect(parseDiffCardPath(getDiffCardPath(source))).toEqual(source)
})

test('encodes the compare range into the card path', () => {
  const source: GitHubDiffSource = {kind: 'compare', range: 'acme:HEAD...release/2', repo: REPO}

  expect(getDiffCardPath(source)).toBe(
    '/og/diffs/acme/widgets/compare/acme%3AHEAD...release%2F2.png',
  )
})

test.each([
  {name: 'a path without the card extension', pathname: '/og/diffs/acme/widgets/pull/7'},
  {name: 'a path outside the card route', pathname: '/og/other/acme/widgets/pull/7.png'},
  {name: 'a path that is not a diff', pathname: '/og/diffs/not-a-diff.png'},
])('names no card for $name', ({pathname}) => {
  expect(parseDiffCardPath(pathname)).toBeUndefined()
})

// The parser keeps a range that does not decode as written, so such a link
// gets the same card its page unfurls with rather than a 404.
test('keeps a compare range that does not decode as written', () => {
  expect(parseDiffCardPath('/og/diffs/acme/widgets/compare/%E0%A4%A.png')).toEqual({
    kind: 'compare',
    range: '%E0%A4%A',
    repo: REPO,
  })
})
