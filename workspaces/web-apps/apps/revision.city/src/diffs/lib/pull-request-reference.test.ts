import {expect, test} from 'vitest'

import {validatePullRequestReference} from './pull-request-reference'

test('accepts a reference and returns only its three fields', () => {
  const input = {owner: 'acme', repo: 'widgets.js', number: '7', extra: 'dropped'}

  expect(validatePullRequestReference(input)).toEqual({
    owner: 'acme',
    repo: 'widgets.js',
    number: '7',
  })
})

test.each([
  {name: 'a missing owner', input: {repo: 'widgets', number: '7'}},
  {name: 'an owner with a slash', input: {owner: 'acme/evil', repo: 'widgets', number: '7'}},
  {name: 'a repository with a space', input: {owner: 'acme', repo: 'wid gets', number: '7'}},
  {name: 'a repository that is only dots', input: {owner: 'acme', repo: '..', number: '7'}},
  {name: 'a number that is not digits', input: {owner: 'acme', repo: 'widgets', number: '7a'}},
  {name: 'a numeric number', input: {owner: 'acme', repo: 'widgets', number: 7}},
  {name: 'a string instead of an object', input: 'acme/widgets#7'},
  {name: 'null', input: null},
])('rejects $name', ({input}) => {
  expect(() => validatePullRequestReference(input)).toThrow('Invalid pull request reference.')
})
