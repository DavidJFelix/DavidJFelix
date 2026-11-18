import {expect, test} from 'vitest'

import {chunkSearchQualifiers, searchPullRequests} from './github-pull-request-search'

// Sends `assignees` through a search answer of one pull request, and gives back what the search read.
const searchAssignees = async (assignees: unknown): Promise<string[] | undefined> => {
  const item = {
    number: 1,
    title: 'Fix the widget',
    repository_url: 'https://api.github.com/repos/octo/widgets',
    assignees,
  }
  const {items} = await searchPullRequests({
    fetcher: async () => Response.json({total_count: 1, items: [item]}),
    qualifiers: ['assignee:@me'],
    token: 'ghu_token',
  })
  return items[0]?.assignees
}

test('searchPullRequests reads the logins of the assignees of a search item', async () => {
  expect(await searchAssignees([{login: 'test-user'}, {login: 'other-user'}])).toEqual([
    'test-user',
    'other-user',
  ])
})

test.each<{name: string; assignees: unknown; expected: string[]}>([
  {name: 'a missing list', assignees: undefined, expected: []},
  {name: 'a list that is not an array', assignees: {login: 'test-user'}, expected: []},
  {
    name: 'entries with no login',
    assignees: [null, 7, {}, {login: ''}, {login: 42}, {login: 'test-user'}],
    expected: ['test-user'],
  },
])('searchPullRequests reads $name as only the logins it has', async ({assignees, expected}) => {
  expect(await searchAssignees(assignees)).toEqual(expected)
})

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
