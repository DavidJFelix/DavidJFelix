import {expect, test} from 'vitest'

import {
  createGitHubApiUrl,
  createGitHubHeaders,
  GITHUB_API_VERSION,
  GITHUB_USER_AGENT,
  type GitHubHeadersParams,
} from './github-http'

const TOKEN = 'token-value'
const CREDENTIALS = {clientId: 'client-id', clientSecret: 'client-secret'}

test.each<[string, GitHubHeadersParams, Record<string, string>]>([
  ['a host other than the API', {}, {'User-Agent': GITHUB_USER_AGENT}],
  [
    'a JSON answer with a token',
    {media: 'json', authorization: {kind: 'token', token: TOKEN}},
    {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  ],
  [
    'a diff answer as the app',
    {media: 'diff', authorization: {kind: 'app', credentials: CREDENTIALS}},
    {
      Accept: 'application/vnd.github.diff',
      Authorization: `Basic ${btoa('client-id:client-secret')}`,
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  ],
  [
    'a raw answer with no authorization',
    {media: 'raw'},
    {
      Accept: 'application/vnd.github.raw',
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  ],
  [
    'a token to a host other than the API',
    {authorization: {kind: 'token', token: TOKEN}},
    {Authorization: `Bearer ${TOKEN}`, 'User-Agent': GITHUB_USER_AGENT},
  ],
])('createGitHubHeaders builds the headers for %s', (_name, params, expected) => {
  expect(createGitHubHeaders(params)).toEqual(expected)
})

test('createGitHubApiUrl puts the path on the API root', () => {
  expect(createGitHubApiUrl({path: '/user/orgs?per_page=100'})).toBe(
    'https://api.github.com/user/orgs?per_page=100',
  )
})

test('createGitHubApiUrl sets each search parameter', () => {
  expect(
    createGitHubApiUrl({path: '/repos/o/r/contents/a%20b', searchParams: {ref: 'main', page: '2'}}),
  ).toBe('https://api.github.com/repos/o/r/contents/a%20b?ref=main&page=2')
})
