import {expect, test} from 'vitest'

import {parseGitHubAccessRemedy} from './github-access-remedy'

test('reads the sign-in remedies', () => {
  expect(parseGitHubAccessRemedy({kind: 'sign-in'})).toEqual({kind: 'sign-in'})
  expect(parseGitHubAccessRemedy({kind: 'sign-in-again'})).toEqual({kind: 'sign-in-again'})
})

test('reads a grant-access remedy pointing at github.com', () => {
  const url = 'https://github.com/apps/revision-city/installations/new'

  expect(parseGitHubAccessRemedy({kind: 'grant-repo-access', url})).toEqual({
    kind: 'grant-repo-access',
    url,
  })
})

test('drops a grant-access remedy pointing anywhere else', () => {
  for (const url of [
    'https://github.com.evil.test/apps/revision-city',
    'http://github.com/apps/revision-city',
    'file:///etc/passwd',
    'not a url',
  ]) {
    expect(parseGitHubAccessRemedy({kind: 'grant-repo-access', url})).toBeUndefined()
  }
})

test('drops malformed payloads', () => {
  expect(parseGitHubAccessRemedy()).toBeUndefined()
  expect(parseGitHubAccessRemedy('sign-in')).toBeUndefined()
  expect(parseGitHubAccessRemedy({kind: 'grant-repo-access'})).toBeUndefined()
  expect(parseGitHubAccessRemedy({kind: 'reboot'})).toBeUndefined()
})
