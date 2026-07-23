import {expect, test} from 'vitest'

import {getPatchViewerHref} from './get-patch-viewer-href'

// Every case is the same shape (an input string in, an href or undefined out),
// so the whole suite is one case table. Case names fold in the original
// describe context (e.g. "full GitHub URLs: ...") the source file used to
// group these under. Viewer hrefs carry the /diffs mount prefix; see
// get-patch-viewer-href.ts.
test.each([
  {
    name: 'full GitHub URLs: PR URL',
    input: 'https://github.com/owner/repo/pull/123',
    expected: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'full GitHub URLs: PR changes tab URL',
    input: 'https://github.com/owner/repo/pull/123/changes',
    expected: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'full GitHub URLs: PR files tab URL',
    input: 'https://github.com/owner/repo/pull/123/files',
    expected: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'full GitHub URLs: compare URL',
    input: 'https://github.com/torvalds/linux/compare/v6.0...v7.0',
    expected: '/diffs/torvalds/linux/compare/v6.0...v7.0',
  },
  {
    name: 'full GitHub URLs: commit URL',
    input: 'https://github.com/owner/repo/commit/abc123def',
    expected: '/diffs/owner/repo/commit/abc123def',
  },
  {
    name: 'full GitHub URLs: PR changes tab scoped to a commit SHA',
    input:
      'https://github.com/pierrecomputer/pierre/pull/692/changes/83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
    expected: '/diffs/pierrecomputer/pierre/commit/83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
  },
  {
    name: 'full GitHub URLs: PR files tab scoped to a commit SHA',
    input: 'https://github.com/owner/repo/pull/123/files/abc1234',
    expected: '/diffs/owner/repo/commit/abc1234',
  },
  {
    name: 'full GitHub URLs: root github.com returns undefined',
    input: 'https://github.com/',
    expected: undefined,
  },
  {
    name: 'domain-relative URLs (no protocol): github.com PR path',
    input: 'github.com/owner/repo/pull/123',
    expected: '/diffs/owner/repo/pull/123',
  },
  {
    name: 'domain-relative URLs (no protocol): github.com compare path',
    input: 'github.com/torvalds/linux/compare/v6.0...v7.0',
    expected: '/diffs/torvalds/linux/compare/v6.0...v7.0',
  },
  {
    name: 'bare GitHub paths (no domain): owner/repo/pull/123',
    input: 'pierrecomputer/pierre/pull/673',
    expected: '/diffs/pierrecomputer/pierre/pull/673',
  },
  {
    name: 'bare GitHub paths (no domain): owner/repo/pull/123/changes',
    input: 'pierrecomputer/pierre/pull/673/changes',
    expected: '/diffs/pierrecomputer/pierre/pull/673',
  },
  {
    name: 'bare GitHub paths (no domain): owner/repo/pull/123/changes/{sha}',
    input: 'pierrecomputer/pierre/pull/692/changes/83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
    expected: '/diffs/pierrecomputer/pierre/commit/83fea5e63ef8751ddbcfabe33154bc2e096c3d85',
  },
  {
    name: 'bare GitHub paths (no domain): owner/repo/compare/a...b',
    input: 'torvalds/linux/compare/v6.0...v7.0',
    expected: '/diffs/torvalds/linux/compare/v6.0...v7.0',
  },
  {
    name: 'bare GitHub paths (no domain): owner/repo only',
    input: 'owner/repo',
    expected: '/diffs/owner/repo',
  },
  {
    name: 'GitHub shorthand (owner/repo#number): pierrecomputer/pierre#673',
    input: 'pierrecomputer/pierre#673',
    expected: '/diffs/pierrecomputer/pierre/pull/673',
  },
  {
    name: 'GitHub shorthand (owner/repo#number): nodejs/node#59805',
    input: 'nodejs/node#59805',
    expected: '/diffs/nodejs/node/pull/59805',
  },
  {
    name: 'raw GitHub diff URLs: raw diff URL',
    input: 'https://patch-diff.githubusercontent.com/raw/owner/repo/pull/123.diff',
    expected: '/diffs/owner/repo/pull/123.diff',
  },
  {
    name: 'invalid inputs: empty string',
    input: '',
    expected: undefined,
  },
  {
    name: 'invalid inputs: whitespace only',
    input: '   ',
    expected: undefined,
  },
  {
    name: 'invalid inputs: gibberish',
    input: 'asdfadfadsf',
    expected: undefined,
  },
  {
    name: 'invalid inputs: root URL only',
    input: 'https://github.com',
    expected: undefined,
  },
])('getPatchViewerHref: $name', ({input, expected}) => {
  expect(getPatchViewerHref(input)).toBe(expected)
})
