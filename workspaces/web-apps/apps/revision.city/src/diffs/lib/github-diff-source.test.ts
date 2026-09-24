import {expect, test} from 'vitest'

import {parseGitHubDiffSource} from './github-diff-source'

const REPO = {owner: 'acme', repo: 'widgets'}

test.each([
  {
    name: 'a pull request',
    path: '/acme/widgets/pull/7',
    source: {kind: 'pull', number: '7', repo: REPO},
  },
  {
    name: 'a pull request diff',
    path: '/acme/widgets/pull/7.diff',
    source: {kind: 'pull', number: '7', repo: REPO},
  },
  {
    name: 'a commit',
    path: '/acme/widgets/commit/83fea5e',
    source: {kind: 'commit', repo: REPO, sha: '83fea5e'},
  },
  {
    name: 'a commit patch',
    path: '/acme/widgets/commit/83fea5e.patch',
    source: {kind: 'commit', repo: REPO, sha: '83fea5e'},
  },
  {
    name: 'a compare range',
    path: '/acme/widgets/compare/v1.0...v2.0',
    source: {kind: 'compare', range: 'v1.0...v2.0', repo: REPO},
  },
  {
    name: 'a compare range with a trailing slash',
    path: '/acme/widgets/compare/v1.0...v2.0/',
    source: {kind: 'compare', range: 'v1.0...v2.0', repo: REPO},
  },
  {
    name: 'a percent-encoded compare range',
    path: '/acme/widgets/compare/acme%3AHEAD...release%2F2',
    source: {kind: 'compare', range: 'acme:HEAD...release/2', repo: REPO},
  },
])('parses $name', ({path, source}) => {
  expect(parseGitHubDiffSource(path)).toEqual(source)
})

// A ref may carry a percent sign, and a router hands the path over already
// decoded, so a range that does not decode again is kept as written instead
// of throwing into the route that asked.
test.each([
  {name: 'a stray percent sign', range: 'foo%...bar'},
  {name: 'a truncated escape', range: '%E0%A4%A'},
])('keeps a compare range with $name as written', ({range}) => {
  expect(parseGitHubDiffSource(`/acme/widgets/compare/${range}`)).toEqual({
    kind: 'compare',
    range,
    repo: REPO,
  })
})

test.each([
  {name: 'the repository root', path: '/acme/widgets'},
  {name: 'a tree path', path: '/acme/widgets/tree/main'},
  {name: 'a pull request without a number', path: '/acme/widgets/pull/seven'},
  {name: 'a commit that is not a sha', path: '/acme/widgets/commit/zebra'},
])('names no source for $name', ({path}) => {
  expect(parseGitHubDiffSource(path)).toBeUndefined()
})
