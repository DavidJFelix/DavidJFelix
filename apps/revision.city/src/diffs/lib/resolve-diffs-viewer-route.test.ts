// cSpell:ignore pierrecomputer -- upstream fixture slug
import {expect, test} from 'vitest'

import {resolveDiffsViewerRoute} from './resolve-diffs-viewer-route'

test('resolveDiffsViewerRoute: empty path redirects to the diffs home', () => {
  expect(resolveDiffsViewerRoute([], undefined)).toEqual({
    kind: 'redirect',
    target: '/diffs',
  })
})

// Canonical paths (default GitHub host and alternate domains) render without a
// rewrite. upstreamPath/url stay upstream-relative (no /diffs prefix) since
// they are used to fetch the upstream diff, not to navigate the app.
test.each([
  {
    name: 'GitHub (default host): PR path renders without rewrite',
    pathSegments: ['owner', 'repo', 'pull', '123'],
    domainInput: undefined,
    expectedDomain: undefined,
    expectedUpstreamPath: '/owner/repo/pull/123',
    expectedUrl: 'https://github.com/owner/repo/pull/123',
  },
  {
    name: 'GitHub (default host): commit path renders without rewrite',
    pathSegments: ['owner', 'repo', 'commit', 'abc1234'],
    domainInput: undefined,
    expectedDomain: undefined,
    expectedUpstreamPath: '/owner/repo/commit/abc1234',
    expectedUrl: 'https://github.com/owner/repo/commit/abc1234',
  },
  {
    name: 'GitHub (default host): empty-string domain is treated as default GitHub',
    pathSegments: ['owner', 'repo', 'pull', '123'],
    domainInput: '',
    expectedDomain: undefined,
    expectedUpstreamPath: '/owner/repo/pull/123',
    expectedUrl: 'https://github.com/owner/repo/pull/123',
  },
  {
    name: 'GitHub (default host) redirects: non-hex SHA-shaped segment is left unmodified',
    pathSegments: ['owner', 'repo', 'pull', '123', 'changes', 'reviews'],
    domainInput: undefined,
    expectedDomain: undefined,
    expectedUpstreamPath: '/owner/repo/pull/123/changes/reviews',
    expectedUrl: 'https://github.com/owner/repo/pull/123/changes/reviews',
  },
  {
    name: 'alternate domain: renders against the requested host without rewriting',
    pathSegments: ['owner', 'repo', 'pull', '123', 'changes'],
    domainInput: 'gitlab.com',
    expectedDomain: 'gitlab.com',
    expectedUpstreamPath: '/owner/repo/pull/123/changes',
    expectedUrl: 'https://gitlab.com/owner/repo/pull/123/changes',
  },
  {
    // Documents that an unexpected empty string falls back to GitHub; the
    // caller is responsible for resolving an Array-typed domain to a string.
    name: 'alternate domain: array-typed domain handling is the caller responsibility',
    pathSegments: ['owner', 'repo', 'pull', '123'],
    domainInput: '',
    expectedDomain: undefined,
    expectedUpstreamPath: '/owner/repo/pull/123',
    expectedUrl: 'https://github.com/owner/repo/pull/123',
  },
])(
  'resolveDiffsViewerRoute: $name',
  ({pathSegments, domainInput, expectedDomain, expectedUpstreamPath, expectedUrl}) => {
    expect(resolveDiffsViewerRoute(pathSegments, domainInput)).toEqual({
      domain: expectedDomain,
      kind: 'render',
      upstreamPath: expectedUpstreamPath,
      url: expectedUrl,
    })
  },
)

// GitHub tab/SHA paths that don't match their canonical form redirect there.
// Redirect targets carry the /diffs mount prefix (they're app-internal
// navigation, unlike the render case's upstream-relative url/upstreamPath).
test.each([
  {
    name: 'GitHub (default host) redirects: PR changes tab redirects to canonical PR path',
    pathSegments: ['owner', 'repo', 'pull', '123', 'changes'],
    expectedTarget: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'GitHub (default host) redirects: PR files tab redirects to canonical PR path',
    pathSegments: ['owner', 'repo', 'pull', '123', 'files'],
    expectedTarget: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'GitHub (default host) redirects: PR changes tab scoped to a SHA redirects to commit path',
    pathSegments: [
      'pierrecomputer',
      'pierre',
      'pull',
      '692',
      'changes',
      '83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
    ],
    expectedTarget: '/diffs/pierrecomputer/pierre/commit/83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
  },
  {
    name: 'GitHub (default host) redirects: PR files tab scoped to a SHA redirects to commit path',
    pathSegments: ['owner', 'repo', 'pull', '123', 'files', 'abc1234'],
    expectedTarget: '/diffs/owner/repo/commit/abc1234',
  },
])('resolveDiffsViewerRoute: $name', ({pathSegments, expectedTarget}) => {
  expect(resolveDiffsViewerRoute(pathSegments, undefined)).toEqual({
    kind: 'redirect',
    target: expectedTarget,
  })
})
