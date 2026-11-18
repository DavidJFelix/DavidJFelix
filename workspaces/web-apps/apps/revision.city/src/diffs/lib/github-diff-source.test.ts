import {expect, test} from 'vitest'

import {
  isSameGitHubRepo,
  parseGitHubDiffSource,
  readPullRequestRange,
  readRepoFullName,
} from './github-diff-source'

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
  {name: 'a dot-segment owner', path: '/../widgets/pull/7'},
  {name: 'a dot-segment repository', path: '/acme/./commit/83fea5e'},
  {name: 'a compare range that decodes to a dot segment', path: '/acme/widgets/compare/%2e%2e'},
  {name: 'an upper-case encoded dot segment', path: '/acme/widgets/compare/%2E'},
  {name: 'an encoded dot segment inside a range', path: '/acme/widgets/compare/main%2F%2e%2e%2Fx'},
])('names no source for $name', ({path}) => {
  expect(parseGitHubDiffSource(path)).toBeUndefined()
})

test.each([
  {name: 'a full name', value: 'acme/widgets', repo: REPO},
  {
    name: 'a repository name with a slash kept',
    value: 'acme/widgets/extra',
    repo: {owner: 'acme', repo: 'widgets/extra'},
  },
  {name: 'no owner', value: '/widgets', repo: undefined},
  {name: 'no repository', value: 'acme/', repo: undefined},
  {name: 'no slash', value: 'acme', repo: undefined},
  {name: 'a value that is not text', value: 7, repo: undefined},
])('readRepoFullName reads $name', ({value, repo}) => {
  expect(readRepoFullName(value)).toEqual(repo)
})

test.each([
  {name: 'the same name in another case', other: {owner: 'Acme', repo: 'Widgets'}, same: true},
  {name: 'another owner', other: {owner: 'fork', repo: 'widgets'}, same: false},
  {name: 'another repository', other: {owner: 'acme', repo: 'gadgets'}, same: false},
])('isSameGitHubRepo compares $name', ({other, same}) => {
  expect(isSameGitHubRepo(REPO, other)).toBe(same)
})

const FORK = {owner: 'fork', repo: 'widgets'}
const RENAMED = {owner: 'acme', repo: 'gizmos'}

function createPullData(baseName: string | null, headName: string | null) {
  return {
    base: {sha: 'base-sha', repo: baseName === null ? null : {full_name: baseName}},
    head: {sha: 'head-sha', repo: headName === null ? null : {full_name: headName}},
  }
}

test.each([
  {
    name: 'a pull request in one repository',
    data: createPullData('acme/widgets', 'acme/widgets'),
    baseRepo: REPO,
    headRepo: REPO,
  },
  {
    name: 'a pull request from a fork',
    data: createPullData('acme/widgets', 'fork/widgets'),
    baseRepo: REPO,
    headRepo: FORK,
  },
  {
    name: 'a pull request from a deleted fork',
    data: createPullData('acme/widgets', null),
    baseRepo: REPO,
    headRepo: REPO,
  },
  {
    name: 'a deleted fork of a renamed base repository',
    data: createPullData('acme/gizmos', null),
    baseRepo: RENAMED,
    headRepo: RENAMED,
  },
  {
    name: 'an answer with no repository names',
    data: createPullData(null, null),
    baseRepo: REPO,
    headRepo: REPO,
  },
])('readPullRequestRange reads $name', ({data, baseRepo, headRepo}) => {
  expect(readPullRequestRange({data, urlRepo: REPO})).toEqual({
    baseSha: 'base-sha',
    headSha: 'head-sha',
    baseRepo,
    headRepo,
  })
})

test.each([
  {name: 'no base sha', data: {head: {sha: 'head-sha'}}},
  {name: 'no head sha', data: {base: {sha: 'base-sha'}}},
  {name: 'an answer that is not an object', data: 'not found'},
])('readPullRequestRange gives no range for $name', ({data}) => {
  expect(readPullRequestRange({data, urlRepo: REPO})).toBeUndefined()
})
