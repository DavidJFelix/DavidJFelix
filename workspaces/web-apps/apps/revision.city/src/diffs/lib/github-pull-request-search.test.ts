import {expect, test} from 'vitest'

import {chunkSearchQualifiers} from './github-pull-request-search'

test('chunkSearchQualifiers keeps every query within the search length limit', () => {
  const qualifiers = Array.from({length: 40}, (_, i) => `repo:owner-${i}/repository-name-${i}`)
  const {chunks} = chunkSearchQualifiers(qualifiers, 10)

  expect(chunks.length).toBeGreaterThan(1)
  for (const chunk of chunks) {
    const query = ['is:pr is:open archived:false', ...chunk].join(' ')
    expect(query.length).toBeLessThanOrEqual(256)
  }
  expect(chunks.flat()).toEqual(qualifiers)
})

test('chunkSearchQualifiers drops the tail once the chunk budget is spent', () => {
  const qualifiers = Array.from({length: 40}, (_, i) => `repo:owner-${i}/repository-name-${i}`)
  const {chunks, truncated} = chunkSearchQualifiers(qualifiers, 2)

  expect(chunks).toHaveLength(2)
  expect(truncated).toBe(true)
})

test('chunkSearchQualifiers skips a qualifier that alone exceeds the limit', () => {
  const oversized = `repo:owner/${'a'.repeat(300)}`
  const {chunks, truncated} = chunkSearchQualifiers([oversized, 'repo:owner/ok'], 3)

  expect(chunks).toEqual([['repo:owner/ok']])
  expect(truncated).toBe(true)
})
