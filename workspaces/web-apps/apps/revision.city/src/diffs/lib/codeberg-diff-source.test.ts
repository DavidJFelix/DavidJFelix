import {expect, test} from 'vitest'

import {
  createCodebergPatchURL,
  createCodebergSourceURL,
  parseCodebergDiffSource,
} from './codeberg-diff-source'

const REPO = {owner: 'acme', repo: 'widgets'}

test.each([
  {
    name: 'a pull request',
    path: '/acme/widgets/pulls/7',
    source: {kind: 'pull', number: '7', repo: REPO},
  },
  {
    name: 'the files tab of a pull request',
    path: '/acme/widgets/pulls/7/files',
    source: {kind: 'pull', number: '7', repo: REPO},
  },
  {
    name: 'a pull request diff with a trailing slash',
    path: '/acme/widgets/pulls/7.diff/',
    source: {kind: 'pull', number: '7', repo: REPO},
  },
  {
    name: 'a commit',
    path: '/acme/widgets/commit/83fea5e',
    source: {kind: 'commit', repo: REPO, sha: '83fea5e'},
  },
  {
    name: 'a compare range',
    path: '/acme/widgets/compare/v1.0...v2.0',
    source: {kind: 'compare', range: 'v1.0...v2.0', repo: REPO},
  },
  {
    name: 'a percent-encoded compare range',
    path: '/acme/widgets/compare/main...feature%2Fx',
    source: {kind: 'compare', range: 'main...feature/x', repo: REPO},
  },
])('parses $name', ({path, source}) => {
  expect(parseCodebergDiffSource(path)).toEqual(source)
})

test.each([
  {name: 'a GitHub-style pull path', path: '/acme/widgets/pull/7'},
  {name: 'a repository root', path: '/acme/widgets'},
  {name: 'an issue', path: '/acme/widgets/issues/7'},
])('does not parse $name', ({path}) => {
  expect(parseCodebergDiffSource(path)).toBeUndefined()
})

test.each([
  {
    path: '/acme/widgets/pulls/7/files',
    patchURL: 'https://codeberg.org/api/v1/repos/acme/widgets/pulls/7.diff',
    sourceURL: 'https://codeberg.org/acme/widgets/pulls/7',
  },
  {
    path: '/acme/widgets/commit/83fea5e',
    patchURL: 'https://codeberg.org/api/v1/repos/acme/widgets/git/commits/83fea5e.diff',
    sourceURL: 'https://codeberg.org/acme/widgets/commit/83fea5e',
  },
  {
    path: '/acme/widgets/compare/main...feature/x',
    patchURL: 'https://codeberg.org/acme/widgets/compare/main...feature%2Fx.diff',
    sourceURL: 'https://codeberg.org/acme/widgets/compare/main...feature%2Fx',
  },
])('fetches $path from $patchURL', ({path, patchURL, sourceURL}) => {
  const source = parseCodebergDiffSource(path)
  if (source === undefined) throw new Error(`no source for ${path}`)
  expect(createCodebergPatchURL(source)).toBe(patchURL)
  expect(createCodebergSourceURL(source)).toBe(sourceURL)
})
